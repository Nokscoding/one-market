-- Secure QR pickup verification for seller -> courier handoff.

create table if not exists public.seller_order_pickup_codes (
  seller_order_id uuid primary key references public.seller_orders(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text,'-',''),
  short_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_assignment_id uuid references public.delivery_assignments(id) on delete set null
);

alter table public.seller_order_pickup_codes enable row level security;

drop policy if exists pickup_codes_seller_read on public.seller_order_pickup_codes;
create policy pickup_codes_seller_read
on public.seller_order_pickup_codes
for select
to authenticated
using (
  exists (
    select 1
    from public.seller_orders so
    join public.stores s on s.id=so.store_id
    where so.id=seller_order_pickup_codes.seller_order_id
      and s.owner_id=(select auth.uid())
      and app_private.is_active_seller((select auth.uid()))
  )
  or app_private.has_staff_permission('delivery.manage')
  or app_private.staff_role()='SUPER_ADMIN'
);

revoke all on public.seller_order_pickup_codes from anon;
grant select on public.seller_order_pickup_codes to authenticated;

create or replace function app_private.ensure_seller_pickup_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status='ready' and old.status is distinct from new.status then
    insert into public.seller_order_pickup_codes(seller_order_id)
    values(new.id)
    on conflict(seller_order_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists zy_seller_order_pickup_code on public.seller_orders;
create trigger zy_seller_order_pickup_code
after update of status on public.seller_orders
for each row
when (old.status is distinct from new.status and new.status='ready')
execute function app_private.ensure_seller_pickup_code();

insert into public.seller_order_pickup_codes(seller_order_id)
select so.id
from public.seller_orders so
where so.status='ready'
on conflict(seller_order_id) do nothing;

create or replace function public.seller_get_pickup_code(p_seller_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code public.seller_order_pickup_codes%rowtype;
  v_order public.seller_orders%rowtype;
begin
  select so.* into v_order
  from public.seller_orders so
  join public.stores s on s.id=so.store_id
  where so.id=p_seller_order_id
    and s.owner_id=(select auth.uid())
    and app_private.is_active_seller((select auth.uid()));

  if not found then raise exception 'SELLER_ORDER_NOT_FOUND'; end if;
  if v_order.status<>'ready' then raise exception 'PICKUP_CODE_NOT_READY'; end if;

  insert into public.seller_order_pickup_codes(seller_order_id)
  values(p_seller_order_id)
  on conflict(seller_order_id) do nothing;

  select * into v_code
  from public.seller_order_pickup_codes
  where seller_order_id=p_seller_order_id;

  return jsonb_build_object(
    'seller_order_id',v_code.seller_order_id,
    'short_code',v_code.short_code,
    'payload','OMPK1:'||v_code.seller_order_id::text||':'||v_code.token,
    'verified',v_code.verified_at is not null,
    'verified_at',v_code.verified_at
  );
end;
$$;

create or replace function public.courier_verify_pickup_code(
  p_assignment_id uuid,
  p_code text,
  p_expected_seller_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.delivery_assignments%rowtype;
  v_code public.seller_order_pickup_codes%rowtype;
  v_seller_order public.seller_orders%rowtype;
  v_clean text := btrim(coalesce(p_code,''));
  v_token text;
  v_id_text text;
  v_store_name text;
  v_verified int;
  v_total int;
begin
  if not app_private.is_active_courier((select auth.uid())) then
    raise exception 'COURIER_FORBIDDEN';
  end if;

  select * into v_assignment
  from public.delivery_assignments
  where id=p_assignment_id
    and courier_user_id=(select auth.uid())
  for update;

  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if v_assignment.status not in ('accepted','picking_up') then
    raise exception 'PICKUP_NOT_ACTIVE';
  end if;

  if v_clean ilike 'OMPK1:%' then
    v_id_text := split_part(v_clean,':',2);
    v_token := split_part(v_clean,':',3);

    select pc.* into v_code
    from public.seller_order_pickup_codes pc
    where pc.seller_order_id::text=v_id_text
      and pc.token=v_token;
  else
    select pc.* into v_code
    from public.seller_order_pickup_codes pc
    where upper(pc.short_code)=upper(v_clean);
  end if;

  if not found then raise exception 'PICKUP_CODE_INVALID'; end if;

  select * into v_seller_order
  from public.seller_orders so
  where so.id=v_code.seller_order_id
    and so.order_id=v_assignment.order_id
  for update;

  if not found then raise exception 'PICKUP_CODE_WRONG_ORDER'; end if;
  if p_expected_seller_order_id is not null
     and v_seller_order.id<>p_expected_seller_order_id then
    raise exception 'PICKUP_CODE_WRONG_STORE';
  end if;
  if v_seller_order.status<>'ready' then raise exception 'PICKUP_NOT_READY'; end if;

  update public.seller_order_pickup_codes
  set verified_at=now(),
      verified_by=(select auth.uid()),
      verified_assignment_id=v_assignment.id
  where seller_order_id=v_seller_order.id
  returning * into v_code;

  select s.name into v_store_name
  from public.stores s
  where s.id=v_seller_order.store_id;

  select
    count(*) filter (
      where pc.verified_assignment_id=v_assignment.id
        and pc.verified_by=(select auth.uid())
        and pc.verified_at is not null
    ),
    count(*)
  into v_verified,v_total
  from public.seller_orders so
  join public.seller_order_pickup_codes pc on pc.seller_order_id=so.id
  where so.order_id=v_assignment.order_id
    and so.status='ready';

  insert into public.order_status_events(order_id,status,label)
  values(
    v_assignment.order_id,
    'ready',
    coalesce(v_store_name,'Boutique')||' · colis vérifié par QR'
  );

  return jsonb_build_object(
    'ok',true,
    'seller_order_id',v_seller_order.id,
    'store_id',v_seller_order.store_id,
    'store_name',v_store_name,
    'verified_count',v_verified,
    'total_pickups',v_total,
    'all_verified',v_verified=v_total
  );
end;
$$;

create or replace function public.courier_my_deliveries()
returns setof jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'assignment_id', da.id,
    'assignment_status', da.status,
    'previous_status', da.previous_status,
    'collection_status', da.collection_status,
    'product_cash_collected_usd', da.product_cash_collected_usd,
    'delivery_fee_collected_cdf', da.delivery_fee_collected_cdf,
    'assigned_at', da.assigned_at,
    'accepted_at', da.accepted_at,
    'picked_up_at', da.picked_up_at,
    'out_for_delivery_at', da.out_for_delivery_at,
    'delivered_at', da.delivered_at,
    'remitted_at', da.remitted_at,
    'order_id', o.id,
    'order_number', o.order_number,
    'order_status', o.status,
    'logistics_status', o.logistics_status,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'items_total_usd', o.items_total,
    'delivery_fee_cdf', o.delivery_fee_cdf,
    'delivery_method', o.delivery_method,
    'customer_note', o.customer_note,
    'shipping', o.shipping_snapshot,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',oi.id,
        'seller_order_id',oi.seller_order_id,
        'name',oi.product_name,
        'image_url',oi.product_image_url,
        'variant',oi.variant_snapshot,
        'quantity',oi.quantity,
        'store_id',oi.store_id
      ) order by oi.created_at), '[]'::jsonb)
      from public.order_items oi
      where oi.order_id=o.id
    ),
    'pickups', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'seller_order_id', so.id,
        'seller_order_number', so.seller_order_number,
        'seller_status', so.status,
        'store_id', s.id,
        'store_name', s.name,
        'contact_name', sp.contact_name,
        'phone', coalesce(sp.phone,s.phone),
        'address_line', sp.address_line,
        'district', sp.district,
        'city', coalesce(sp.city,s.city),
        'landmark', sp.landmark,
        'instructions', sp.instructions,
        'latitude', sp.latitude,
        'longitude', sp.longitude,
        'pickup_verified',
          pc.verified_assignment_id=da.id
          and pc.verified_by=(select auth.uid())
          and pc.verified_at is not null,
        'verified_at',case
          when pc.verified_assignment_id=da.id
           and pc.verified_by=(select auth.uid())
          then pc.verified_at else null end,
        'items', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id',oi.id,
            'name',oi.product_name,
            'image_url',oi.product_image_url,
            'variant',oi.variant_snapshot,
            'quantity',oi.quantity
          ) order by oi.created_at),'[]'::jsonb)
          from public.order_items oi
          where oi.seller_order_id=so.id
        )
      ) order by so.created_at), '[]'::jsonb)
      from public.seller_orders so
      join public.stores s on s.id=so.store_id
      left join public.store_pickup_points sp on sp.store_id=s.id
      left join public.seller_order_pickup_codes pc on pc.seller_order_id=so.id
      where so.order_id=o.id
        and so.status not in ('cancelled','refused','failed')
    ),
    'verified_pickups',(
      select count(*)
      from public.seller_orders so
      join public.seller_order_pickup_codes pc on pc.seller_order_id=so.id
      where so.order_id=o.id
        and so.status='ready'
        and pc.verified_assignment_id=da.id
        and pc.verified_by=(select auth.uid())
        and pc.verified_at is not null
    ),
    'total_pickups',(
      select count(*)
      from public.seller_orders so
      where so.order_id=o.id
        and so.status not in ('cancelled','refused','failed')
    ),
    'open_incidents', (
      select count(*)
      from public.delivery_incidents di
      where di.assignment_id=da.id and di.status='open'
    )
  )
  from public.delivery_assignments da
  join public.orders o on o.id=da.order_id
  where da.courier_user_id=(select auth.uid())
    and app_private.is_active_courier((select auth.uid()))
    and da.status <> 'cancelled'
  order by
    case da.status
      when 'out_for_delivery' then 1
      when 'picked_up' then 2
      when 'picking_up' then 3
      when 'accepted' then 4
      when 'assigned' then 5
      when 'problem' then 6
      when 'delivered' then 7
      else 8
    end,
    da.assigned_at desc;
$$;

create or replace function public.courier_delivery_action(
  p_assignment_id uuid,
  p_action text
)
returns public.delivery_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.delivery_assignments%rowtype;
  v_order public.orders%rowtype;
  v_label text;
  v_restore text;
begin
  if not app_private.is_active_courier((select auth.uid())) then raise exception 'COURIER_FORBIDDEN'; end if;

  select * into v
  from public.delivery_assignments
  where id=p_assignment_id and courier_user_id=(select auth.uid())
  for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;

  select * into v_order from public.orders where id=v.order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  case p_action
    when 'accept' then
      if v.status<>'assigned' then raise exception 'INVALID_DELIVERY_TRANSITION'; end if;
      update public.delivery_assignments
      set status='accepted',accepted_at=now(),updated_at=now()
      where id=v.id returning * into v;

    when 'start_pickup' then
      if v.status<>'accepted' then raise exception 'INVALID_DELIVERY_TRANSITION'; end if;
      update public.delivery_assignments
      set status='picking_up',updated_at=now()
      where id=v.id returning * into v;

    when 'picked_up' then
      if v.status not in ('accepted','picking_up') then raise exception 'INVALID_DELIVERY_TRANSITION'; end if;
      if not exists(select 1 from public.seller_orders where order_id=v.order_id and status='ready') then
        raise exception 'ORDER_NOT_READY';
      end if;
      if exists(
        select 1 from public.seller_orders
        where order_id=v.order_id and status not in ('ready','refused','cancelled','failed')
      ) then
        raise exception 'ORDER_NOT_READY';
      end if;
      if exists(
        select 1
        from public.seller_orders so
        left join public.seller_order_pickup_codes pc on pc.seller_order_id=so.id
        where so.order_id=v.order_id
          and so.status='ready'
          and (
            pc.seller_order_id is null
            or pc.verified_at is null
            or pc.verified_by<>(select auth.uid())
            or pc.verified_assignment_id<>v.id
          )
      ) then
        raise exception 'PICKUP_QR_REQUIRED';
      end if;

      update public.seller_orders
      set status='picked_up',logistics_status='picked_up',updated_at=now()
      where order_id=v.order_id and status='ready';

      update public.delivery_assignments
      set status='picked_up',picked_up_at=now(),updated_at=now()
      where id=v.id returning * into v;

      v_label:='Tous les colis ont été vérifiés et récupérés par le livreur';

    when 'out_for_delivery' then
      if v.status<>'picked_up' then raise exception 'INVALID_DELIVERY_TRANSITION'; end if;

      update public.seller_orders
      set status='out_for_delivery',logistics_status='out_for_delivery',updated_at=now()
      where order_id=v.order_id and status='picked_up';

      update public.delivery_assignments
      set status='out_for_delivery',out_for_delivery_at=now(),updated_at=now()
      where id=v.id returning * into v;

      v_label:='Commande en livraison';

    when 'delivered' then
      if v.status<>'out_for_delivery' then raise exception 'INVALID_DELIVERY_TRANSITION'; end if;

      update public.seller_orders
      set status='delivered',logistics_status='delivered',updated_at=now()
      where order_id=v.order_id and status='out_for_delivery';

      update public.delivery_assignments
      set status='delivered',
          collection_status=case when v_order.payment_method='cod' then 'collected' else collection_status end,
          product_cash_collected_usd=case when v_order.payment_method='cod' then coalesce(v_order.items_total,0) else product_cash_collected_usd end,
          delivery_fee_collected_cdf=case when v_order.payment_method='cod' then coalesce(v_order.delivery_fee_cdf,0) else delivery_fee_collected_cdf end,
          delivered_at=now(),
          updated_at=now()
      where id=v.id returning * into v;

      v_label:='Commande livrée';

    when 'resume' then
      if v.status<>'problem' or v.previous_status is null then raise exception 'INVALID_DELIVERY_TRANSITION'; end if;
      v_restore:=v.previous_status;

      update public.delivery_assignments
      set status=v_restore,previous_status=null,updated_at=now()
      where id=v.id returning * into v;

      if v_restore='out_for_delivery' then
        update public.orders set status='out_for_delivery',logistics_status='out_for_delivery',updated_at=now() where id=v.order_id;
      elsif v_restore='picked_up' then
        update public.orders set status='picked_up',logistics_status='picked_up',updated_at=now() where id=v.order_id;
      else
        update public.orders set status='ready',logistics_status='ready',updated_at=now()
        where id=v.order_id and status='problem';
      end if;

      v_label:='Livraison reprise par le livreur';

    else
      raise exception 'INVALID_DELIVERY_ACTION';
  end case;

  if v_label is not null then
    insert into public.order_status_events(order_id,status,label)
    values(
      v.order_id,
      coalesce((select status from public.orders where id=v.order_id),'pending_confirmation'),
      v_label
    );

    insert into public.notifications(user_id,title,body,type,link)
    values(
      v_order.customer_id,
      'Mise à jour de livraison',
      v_label || ' pour ' || v_order.order_number || '.',
      'order',
      '/orders/'||v.order_id::text
    );
  end if;

  return v;
end;
$$;

revoke all on function public.seller_get_pickup_code(uuid) from public;
revoke execute on function public.seller_get_pickup_code(uuid) from anon;
grant execute on function public.seller_get_pickup_code(uuid) to authenticated;

revoke all on function public.courier_verify_pickup_code(uuid,text,uuid) from public;
revoke execute on function public.courier_verify_pickup_code(uuid,text,uuid) from anon;
grant execute on function public.courier_verify_pickup_code(uuid,text,uuid) to authenticated;

update public.delivery_methods
set description = case code
  when 'standard' then 'Livraison estimée sous 48 à 72 h.'
  when 'express' then 'Livraison prioritaire estimée sous 24 h.'
  else description
end,
updated_at = now()
where code in ('standard','express');

comment on table public.seller_order_pickup_codes is
'One-time pickup verification codes shown by sellers and scanned by the assigned One Market courier.';
