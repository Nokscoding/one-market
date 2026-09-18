-- Automatic One Market dispatch: seller prepares -> ready -> courier assignment -> pickup -> delivery.

alter table public.delivery_assignments
  add column if not exists assignment_source text not null default 'manual'
  check (assignment_source in ('manual','auto'));

create or replace function app_private.notify_dispatch_attention(
  p_order_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number text;
  v_body text;
begin
  select order_number into v_number from public.orders where id=p_order_id;
  if v_number is null then return; end if;

  v_body := case p_reason
    when 'pickup_missing' then v_number || ' · adresse/numéro de ramassage manquant pour au moins une boutique.'
    when 'no_courier' then v_number || ' · aucun livreur disponible pour l’assignation automatique.'
    else v_number || ' · intervention logistique requise.'
  end;

  insert into public.admin_notifications(user_id,title,body,type,link,meta)
  select
    s.user_id,
    'Dispatch livraison',
    v_body,
    'delivery',
    '/delivery',
    jsonb_build_object('order_id',p_order_id,'reason',p_reason)
  from public.admin_staff s
  where s.status='active'
    and s.staff_role in ('SUPER_ADMIN','OPERATIONS_MANAGER')
    and not exists (
      select 1
      from public.admin_notifications n
      where n.user_id=s.user_id
        and n.is_read=false
        and n.type='delivery'
        and n.meta->>'order_id'=p_order_id::text
        and n.meta->>'reason'=p_reason
        and n.created_at > now()-interval '1 hour'
    );
end;
$$;

create or replace function app_private.try_auto_assign_delivery(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_courier uuid;
  v_assignment public.delivery_assignments%rowtype;
  v_missing_pickup boolean;
begin
  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

  if not found then return false; end if;

  if v_order.status in ('delivered','partially_completed','cancelled','refused','failed') then
    return false;
  end if;

  if v_order.payment_status='cancelled'
     or (v_order.payment_method='mobile_money' and v_order.payment_status<>'paid') then
    return false;
  end if;

  if not exists (
    select 1 from public.seller_orders so
    where so.order_id=p_order_id
      and so.status not in ('refused','cancelled','failed')
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.seller_orders so
    where so.order_id=p_order_id
      and so.status not in ('refused','cancelled','failed','ready')
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.delivery_assignments da
    where da.order_id=p_order_id
      and da.status <> 'cancelled'
  ) then
    return true;
  end if;

  select exists (
    select 1
    from public.seller_orders so
    left join public.store_pickup_points sp on sp.store_id=so.store_id
    where so.order_id=p_order_id
      and so.status='ready'
      and (
        sp.store_id is null
        or nullif(btrim(sp.address_line),'') is null
        or nullif(btrim(sp.phone),'') is null
      )
  ) into v_missing_pickup;

  if v_missing_pickup then
    perform app_private.notify_dispatch_attention(p_order_id,'pickup_missing');

    insert into public.notifications(user_id,title,body,type,link)
    select distinct
      st.owner_id,
      'Adresse de ramassage requise',
      'Votre commande est prête, mais One Market a besoin de votre adresse et numéro de ramassage avant d’envoyer un livreur.',
      'order',
      '/seller?tab=store'
    from public.seller_orders so
    join public.stores st on st.id=so.store_id
    left join public.store_pickup_points sp on sp.store_id=so.store_id
    where so.order_id=p_order_id
      and so.status='ready'
      and (
        sp.store_id is null
        or nullif(btrim(sp.address_line),'') is null
        or nullif(btrim(sp.phone),'') is null
      )
      and not exists (
        select 1 from public.notifications n
        where n.user_id=st.owner_id
          and n.type='order'
          and n.title='Adresse de ramassage requise'
          and n.created_at > now()-interval '1 hour'
      );

    return false;
  end if;

  select c.user_id into v_courier
  from public.courier_profiles c
  join public.admin_staff s on s.user_id=c.user_id
  join public.profiles p on p.id=c.user_id
  where c.status='active'
    and c.is_available=true
    and s.staff_role='COURIER'
    and s.status='active'
    and p.account_status='active'
  order by
    (
      select count(*)
      from public.delivery_assignments da
      where da.courier_user_id=c.user_id
        and da.status not in ('delivered','cancelled')
    ) asc,
    (
      select max(da.assigned_at)
      from public.delivery_assignments da
      where da.courier_user_id=c.user_id
    ) asc nulls first,
    c.hired_at asc
  for update of c skip locked
  limit 1;

  if v_courier is null then
    perform app_private.notify_dispatch_attention(p_order_id,'no_courier');
    return false;
  end if;

  insert into public.delivery_assignments(
    order_id,courier_user_id,status,collection_status,assigned_by,assigned_at,assignment_source
  )
  values(
    p_order_id,v_courier,'assigned','not_collected',null,now(),'auto'
  )
  on conflict(order_id) do update set
    courier_user_id=excluded.courier_user_id,
    status='assigned',
    previous_status=null,
    collection_status='not_collected',
    product_cash_collected_usd=0,
    delivery_fee_collected_cdf=0,
    assigned_by=null,
    assigned_at=now(),
    accepted_at=null,
    picked_up_at=null,
    out_for_delivery_at=null,
    delivered_at=null,
    remitted_at=null,
    assignment_source='auto',
    updated_at=now()
  where public.delivery_assignments.status='cancelled'
  returning * into v_assignment;

  if v_assignment.id is null then
    return exists(
      select 1 from public.delivery_assignments
      where order_id=p_order_id and status<>'cancelled'
    );
  end if;

  insert into public.notifications(user_id,title,body,type,link)
  values(
    v_courier,
    'Nouvelle course One Market',
    'La commande '||v_order.order_number||' est prête. Ramassage boutique puis livraison client.',
    'delivery',
    '/courier'
  );

  if v_order.customer_id is not null then
    insert into public.notifications(user_id,title,body,type,link)
    values(
      v_order.customer_id,
      'Livreur One Market assigné',
      'Un livreur a été affecté à votre commande '||v_order.order_number||'. Il va d’abord récupérer les articles auprès de la boutique.',
      'order',
      '/orders/'||p_order_id::text
    );
  end if;

  insert into public.order_status_events(order_id,status,label)
  values(p_order_id,'ready','Commande prête · un livreur One Market a été assigné');

  return true;
end;
$$;

create or replace function app_private.auto_dispatch_ready_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status='ready' and old.status is distinct from new.status then
    perform app_private.try_auto_assign_delivery(new.order_id);
  end if;
  return new;
end;
$$;

drop trigger if exists zz_seller_orders_auto_dispatch on public.seller_orders;
create trigger zz_seller_orders_auto_dispatch
after update of status on public.seller_orders
for each row
when (old.status is distinct from new.status and new.status='ready')
execute function app_private.auto_dispatch_ready_order();

drop policy if exists store_pickup_points_select_owner on public.store_pickup_points;
create policy store_pickup_points_select_owner
on public.store_pickup_points
for select
to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id=store_pickup_points.store_id
      and s.owner_id=(select auth.uid())
      and app_private.is_active_seller((select auth.uid()))
  )
);

create or replace function public.seller_upsert_pickup_point(
  p_store_id uuid,
  p_contact_name text,
  p_phone text,
  p_address_line text,
  p_district text default null,
  p_city text default 'Lubumbashi',
  p_landmark text default null,
  p_instructions text default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns public.store_pickup_points
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.store_pickup_points%rowtype;
  v_order_id uuid;
begin
  if not exists (
    select 1 from public.stores s
    where s.id=p_store_id
      and s.owner_id=(select auth.uid())
      and s.status='active'
      and app_private.is_active_seller((select auth.uid()))
  ) then
    raise exception 'SELLER_STORE_FORBIDDEN';
  end if;

  if nullif(btrim(p_phone),'') is null then raise exception 'PICKUP_PHONE_REQUIRED'; end if;
  if nullif(btrim(p_address_line),'') is null then raise exception 'PICKUP_ADDRESS_REQUIRED'; end if;

  insert into public.store_pickup_points(
    store_id,contact_name,phone,address_line,district,city,landmark,instructions,latitude,longitude
  )
  values(
    p_store_id,
    nullif(btrim(p_contact_name),''),
    btrim(p_phone),
    btrim(p_address_line),
    nullif(btrim(p_district),''),
    coalesce(nullif(btrim(p_city),''),'Lubumbashi'),
    nullif(btrim(p_landmark),''),
    nullif(btrim(p_instructions),''),
    p_latitude,
    p_longitude
  )
  on conflict(store_id) do update set
    contact_name=excluded.contact_name,
    phone=excluded.phone,
    address_line=excluded.address_line,
    district=excluded.district,
    city=excluded.city,
    landmark=excluded.landmark,
    instructions=excluded.instructions,
    latitude=excluded.latitude,
    longitude=excluded.longitude,
    updated_at=now()
  returning * into v;

  for v_order_id in
    select distinct so.order_id
    from public.seller_orders so
    where so.store_id=p_store_id
      and so.status='ready'
      and not exists (
        select 1 from public.delivery_assignments da
        where da.order_id=so.order_id and da.status<>'cancelled'
      )
  loop
    perform app_private.try_auto_assign_delivery(v_order_id);
  end loop;

  return v;
end;
$$;

revoke all on function public.seller_upsert_pickup_point(uuid,text,text,text,text,text,text,text,numeric,numeric) from public;
revoke execute on function public.seller_upsert_pickup_point(uuid,text,text,text,text,text,text,text,numeric,numeric) from anon;
grant execute on function public.seller_upsert_pickup_point(uuid,text,text,text,text,text,text,text,numeric,numeric) to authenticated;

create or replace function public.erp_assign_courier(
  p_order_id uuid,
  p_courier_user_id uuid
)
returns public.delivery_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.delivery_assignments%rowtype;
  v_order public.orders%rowtype;
  b jsonb;
begin
  if not app_private.has_staff_permission('delivery.manage')
     and app_private.staff_role()<>'SUPER_ADMIN' then
    raise exception 'ERP_FORBIDDEN';
  end if;

  if not app_private.is_active_courier(p_courier_user_id) then raise exception 'COURIER_NOT_ACTIVE'; end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status in ('delivered','partially_completed','cancelled','refused','failed') then raise exception 'ORDER_STATUS_FINAL'; end if;
  if v_order.payment_status='cancelled'
     or (v_order.payment_method='mobile_money' and v_order.payment_status<>'paid') then
    raise exception 'PAYMENT_NOT_CONFIRMED';
  end if;

  select to_jsonb(da) into b from public.delivery_assignments da where da.order_id=p_order_id;

  if b is not null and exists(
    select 1 from public.delivery_assignments
    where order_id=p_order_id and status in ('picked_up','out_for_delivery','delivered')
  ) then
    raise exception 'DELIVERY_ALREADY_IN_PROGRESS';
  end if;

  insert into public.delivery_assignments(
    order_id,courier_user_id,status,collection_status,assigned_by,assigned_at,assignment_source
  )
  values(
    p_order_id,p_courier_user_id,'assigned','not_collected',(select auth.uid()),now(),'manual'
  )
  on conflict(order_id) do update set
    courier_user_id=excluded.courier_user_id,
    status='assigned',
    previous_status=null,
    collection_status='not_collected',
    product_cash_collected_usd=0,
    delivery_fee_collected_cdf=0,
    assigned_by=excluded.assigned_by,
    assigned_at=now(),
    accepted_at=null,
    picked_up_at=null,
    out_for_delivery_at=null,
    delivered_at=null,
    remitted_at=null,
    assignment_source='manual',
    updated_at=now()
  returning * into v;

  insert into public.notifications(user_id,title,body,type,link)
  values(
    p_courier_user_id,
    'Nouvelle livraison assignée',
    'La commande '||v_order.order_number||' vous a été assignée.',
    'delivery',
    '/courier'
  );

  perform app_private.write_audit('delivery.assign','order',p_order_id::text,b,to_jsonb(v));
  return v;
end;
$$;

comment on function app_private.try_auto_assign_delivery(uuid)
is 'Automatically dispatches a ready One Market order to the least-loaded available NKS courier after all live seller suborders are ready and pickup contacts are configured.';
