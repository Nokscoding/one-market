
alter table public.courier_profiles
  add column if not exists country_code text not null default 'CD',
  add column if not exists city text;

alter table public.orders
  add column if not exists is_intercity boolean not null default false,
  add column if not exists origin_cities text[] not null default '{}'::text[],
  add column if not exists destination_country_code text,
  add column if not exists destination_city text,
  add column if not exists intercity_surcharge_cdf integer not null default 0,
  add column if not exists estimated_delivery_min_days integer,
  add column if not exists estimated_delivery_max_days integer,
  add column if not exists intercity_arrived_at timestamptz;

alter table public.delivery_assignments
  add column if not exists courier_earning_cdf integer not null default 0;

alter table public.delivery_assignments drop constraint if exists delivery_assignments_assignment_source_check;
alter table public.delivery_assignments
  add constraint delivery_assignments_assignment_source_check
  check (assignment_source in ('manual','auto','claim'));

insert into public.marketplace_settings(key,value)
values (
  'logistics',
  jsonb_build_object(
    'intercity_surcharge_cdf',25000,
    'local_standard_min_days',1,
    'local_standard_max_days',3,
    'local_express_min_days',1,
    'local_express_max_days',2,
    'intercity_standard_min_days',3,
    'intercity_standard_max_days',7,
    'intercity_express_min_days',2,
    'intercity_express_max_days',5,
    'courier_standard_earning_cdf',3000,
    'courier_express_earning_cdf',7000
  )
)
on conflict (key) do nothing;

create or replace function app_private.reprice_order_delivery(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_order public.orders%rowtype;
  v_destination_city text;
  v_destination_country text;
  v_origin_cities text[];
  v_intercity_count integer;
  v_base_fee integer;
  v_surcharge_each integer := 25000;
  v_surcharge integer := 0;
  v_min_days integer;
  v_max_days integer;
  v_settings jsonb := '{}'::jsonb;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then return; end if;

  v_destination_city := nullif(btrim(coalesce(v_order.shipping_snapshot->>'city','')),'');
  v_destination_country := coalesce(nullif(btrim(v_order.shipping_snapshot->>'country_code'),''),'CD');

  select coalesce(array_agg(distinct s.city order by s.city) filter (where nullif(btrim(s.city),'') is not null),'{}'::text[])
  into v_origin_cities
  from public.order_items oi
  join public.stores s on s.id=oi.store_id
  where oi.order_id=p_order_id;

  select count(distinct lower(btrim(s.city)))
  into v_intercity_count
  from public.order_items oi
  join public.stores s on s.id=oi.store_id
  where oi.order_id=p_order_id
    and nullif(btrim(s.city),'') is not null
    and v_destination_city is not null
    and lower(btrim(s.city)) <> lower(btrim(v_destination_city));

  select coalesce(value,'{}'::jsonb) into v_settings
  from public.marketplace_settings where key='logistics';

  v_surcharge_each := greatest(0,coalesce((v_settings->>'intercity_surcharge_cdf')::integer,25000));
  v_base_fee := app_private.resolve_delivery_fee(v_order.customer_id,v_order.delivery_method);
  v_surcharge := case when v_destination_country='CD' then coalesce(v_intercity_count,0)*v_surcharge_each else 0 end;

  if coalesce(v_intercity_count,0)>0 then
    if v_order.delivery_method='express' then
      v_min_days := coalesce((v_settings->>'intercity_express_min_days')::integer,2);
      v_max_days := coalesce((v_settings->>'intercity_express_max_days')::integer,5);
    else
      v_min_days := coalesce((v_settings->>'intercity_standard_min_days')::integer,3);
      v_max_days := coalesce((v_settings->>'intercity_standard_max_days')::integer,7);
    end if;
  else
    if v_order.delivery_method='express' then
      v_min_days := coalesce((v_settings->>'local_express_min_days')::integer,1);
      v_max_days := coalesce((v_settings->>'local_express_max_days')::integer,2);
    else
      v_min_days := coalesce((v_settings->>'local_standard_min_days')::integer,1);
      v_max_days := coalesce((v_settings->>'local_standard_max_days')::integer,3);
    end if;
  end if;

  update public.orders
  set
    is_intercity = coalesce(v_intercity_count,0)>0,
    origin_cities = v_origin_cities,
    destination_country_code = v_destination_country,
    destination_city = v_destination_city,
    intercity_surcharge_cdf = v_surcharge,
    estimated_delivery_min_days = greatest(1,v_min_days),
    estimated_delivery_max_days = greatest(greatest(1,v_min_days),v_max_days),
    delivery_fee_cdf = greatest(0,v_base_fee+v_surcharge),
    shipping_snapshot = coalesce(shipping_snapshot,'{}'::jsonb) || jsonb_build_object(
      'origin_cities',v_origin_cities,
      'destination_city',v_destination_city,
      'destination_country_code',v_destination_country,
      'is_intercity',coalesce(v_intercity_count,0)>0,
      'intercity_surcharge_cdf',v_surcharge,
      'estimated_delivery_min_days',greatest(1,v_min_days),
      'estimated_delivery_max_days',greatest(greatest(1,v_min_days),v_max_days)
    ),
    updated_at=now()
  where id=p_order_id;
end;
$function$;

create or replace function app_private.reprice_order_delivery_from_item()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform app_private.reprice_order_delivery(coalesce(new.order_id,old.order_id));
  return coalesce(new,old);
end;
$function$;

drop trigger if exists order_items_reprice_delivery on public.order_items;
create trigger order_items_reprice_delivery
after insert or update or delete on public.order_items
for each row execute function app_private.reprice_order_delivery_from_item();

create or replace function app_private.auto_dispatch_ready_order()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_intercity boolean;
  v_logistics text;
  v_customer uuid;
  v_number text;
begin
  if new.status='ready' and old.status is distinct from new.status then
    select is_intercity,logistics_status,customer_id,order_number
      into v_intercity,v_logistics,v_customer,v_number
    from public.orders
    where id=new.order_id;

    if coalesce(v_intercity,false) and v_logistics is distinct from 'arrived_destination' then
      update public.orders
      set logistics_status='intercity_transit',updated_at=now()
      where id=new.order_id
        and logistics_status is distinct from 'intercity_transit';

      if not exists(
        select 1 from public.order_status_events
        where order_id=new.order_id and status='intercity_transit'
      ) then
        insert into public.order_status_events(order_id,status,label)
        values(new.order_id,'intercity_transit','Commande en transport inter-ville vers la ville de livraison');

        if v_customer is not null then
          insert into public.notifications(user_id,title,body,type,link,meta)
          values(
            v_customer,
            'Transport inter-ville',
            'Votre commande '||v_number||' est en transfert vers votre ville avant la livraison locale.',
            'order',
            '/orders/'||new.order_id::text,
            jsonb_build_object('order_id',new.order_id,'status','intercity_transit')
          );
        end if;
      end if;
      return new;
    end if;

    perform app_private.try_auto_assign_delivery(new.order_id);
  end if;
  return new;
end;
$function$;

create or replace function public.erp_mark_intercity_arrived(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path=''
as $function$
declare
  v public.orders%rowtype;
begin
  if not app_private.has_staff_permission('delivery.manage')
     and app_private.staff_role()<>'SUPER_ADMIN' then
    raise exception 'ERP_FORBIDDEN';
  end if;

  select * into v from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if not v.is_intercity then raise exception 'ORDER_NOT_INTERCITY'; end if;

  update public.orders
  set logistics_status='arrived_destination',intercity_arrived_at=coalesce(intercity_arrived_at,now()),updated_at=now()
  where id=p_order_id
  returning * into v;

  insert into public.order_status_events(order_id,status,label)
  values(p_order_id,'arrived_destination','Commande arrivée dans la ville de livraison · affectation du livreur local');

  insert into public.notifications(user_id,title,body,type,link,meta)
  values(
    v.customer_id,
    'Commande arrivée dans votre ville',
    'Votre commande '||v.order_number||' est arrivée dans votre ville. Un livreur local va prendre le relais.',
    'order',
    '/orders/'||v.id::text,
    jsonb_build_object('order_id',v.id,'status','arrived_destination')
  );

  perform app_private.try_auto_assign_delivery(p_order_id);
  perform app_private.write_audit('delivery.intercity_arrived','order',p_order_id::text,null,to_jsonb(v));

  return v;
end;
$function$;

revoke all on function public.erp_mark_intercity_arrived(uuid) from public,anon;
grant execute on function public.erp_mark_intercity_arrived(uuid) to authenticated;

create or replace function public.courier_available_deliveries()
returns setof jsonb
language sql
security definer
set search_path=''
as $function$
  select jsonb_build_object(
    'order_id',o.id,
    'order_number',o.order_number,
    'delivery_method',o.delivery_method,
    'delivery_fee_cdf',o.delivery_fee_cdf,
    'items_total_usd',o.items_total,
    'payment_method',o.payment_method,
    'destination_city',o.destination_city,
    'is_intercity',o.is_intercity,
    'estimated_delivery_min_days',o.estimated_delivery_min_days,
    'estimated_delivery_max_days',o.estimated_delivery_max_days,
    'shipping',o.shipping_snapshot,
    'pickup_count',(
      select count(*) from public.seller_orders so
      where so.order_id=o.id and so.status='ready'
    ),
    'first_pickup_city',(
      select min(coalesce(sp.city,s.city))
      from public.seller_orders so
      join public.stores s on s.id=so.store_id
      left join public.store_pickup_points sp on sp.store_id=s.id
      where so.order_id=o.id and so.status='ready'
    )
  )
  from public.orders o
  join public.courier_profiles cp on cp.user_id=(select auth.uid())
  where app_private.is_active_courier((select auth.uid()))
    and cp.is_available=true
    and o.status='ready'
    and (not o.is_intercity or o.logistics_status='arrived_destination')
    and not exists(
      select 1 from public.delivery_assignments da
      where da.order_id=o.id and da.status<>'cancelled'
    )
    and not exists(
      select 1 from public.seller_orders so
      where so.order_id=o.id and so.status not in ('ready','refused','cancelled','failed')
    )
    and (
      nullif(btrim(cp.city),'') is null
      or nullif(btrim(o.destination_city),'') is null
      or lower(btrim(cp.city))=lower(btrim(o.destination_city))
    )
  order by o.created_at asc
  limit 40;
$function$;

revoke all on function public.courier_available_deliveries() from public,anon;
grant execute on function public.courier_available_deliveries() to authenticated;

create or replace function public.courier_claim_delivery(p_order_id uuid)
returns public.delivery_assignments
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_order public.orders%rowtype;
  v_profile public.courier_profiles%rowtype;
  v_assignment public.delivery_assignments%rowtype;
  v_settings jsonb := '{}'::jsonb;
  v_earning integer := 0;
begin
  if not app_private.is_active_courier((select auth.uid())) then raise exception 'COURIER_FORBIDDEN'; end if;

  select * into v_profile
  from public.courier_profiles
  where user_id=(select auth.uid())
  for update;
  if not found or not v_profile.is_available then raise exception 'COURIER_NOT_AVAILABLE'; end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status<>'ready' then raise exception 'ORDER_NOT_READY'; end if;
  if v_order.is_intercity and v_order.logistics_status<>'arrived_destination' then raise exception 'INTERCITY_NOT_ARRIVED'; end if;
  if nullif(btrim(v_profile.city),'') is not null
     and nullif(btrim(v_order.destination_city),'') is not null
     and lower(btrim(v_profile.city))<>lower(btrim(v_order.destination_city)) then
    raise exception 'DELIVERY_CITY_MISMATCH';
  end if;
  if exists(select 1 from public.delivery_assignments where order_id=p_order_id and status<>'cancelled') then
    raise exception 'DELIVERY_ALREADY_ASSIGNED';
  end if;

  select coalesce(value,'{}'::jsonb) into v_settings
  from public.marketplace_settings where key='logistics';

  v_earning := case when v_order.delivery_method='express'
    then coalesce((v_settings->>'courier_express_earning_cdf')::integer,7000)
    else coalesce((v_settings->>'courier_standard_earning_cdf')::integer,3000)
  end;

  insert into public.delivery_assignments(
    order_id,courier_user_id,status,collection_status,assigned_at,assignment_source,courier_earning_cdf
  )
  values(
    p_order_id,(select auth.uid()),'accepted','not_collected',now(),'claim',greatest(0,v_earning)
  )
  returning * into v_assignment;

  update public.delivery_assignments set accepted_at=now() where id=v_assignment.id returning * into v_assignment;

  insert into public.order_status_events(order_id,status,label)
  values(p_order_id,'ready','Un livreur One Market a accepté la livraison');

  insert into public.notifications(user_id,title,body,type,link,meta)
  values(
    v_order.customer_id,
    'Livreur One Market assigné',
    'Un livreur a accepté votre commande '||v_order.order_number||' et va récupérer vos articles.',
    'order',
    '/orders/'||p_order_id::text,
    jsonb_build_object('order_id',p_order_id,'status','courier_accepted')
  );

  return v_assignment;
exception
  when unique_violation then
    raise exception 'DELIVERY_ALREADY_ASSIGNED';
end;
$function$;

revoke all on function public.courier_claim_delivery(uuid) from public,anon;
grant execute on function public.courier_claim_delivery(uuid) to authenticated;

create or replace function app_private.seller_order_is_payout_eligible(p_seller_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists(
    select 1
    from public.seller_orders so
    join public.orders o on o.id=so.order_id
    where so.id=p_seller_order_id
      and so.status='delivered'
      and (
        (o.payment_method='mobile_money' and o.payment_status='paid')
        or
        (
          o.payment_method='cod'
          and o.payment_status='cash_received'
          and exists(
            select 1
            from public.delivery_assignments da
            where da.order_id=o.id
              and da.status='delivered'
              and da.collection_status='remitted'
              and da.remitted_at is not null
          )
        )
      )
  );
$function$;

revoke all on function app_private.seller_order_is_payout_eligible(uuid) from public,anon,authenticated;

create or replace function public.erp_create_seller_payout(
  p_store_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_payment_method text default 'mobile_money',
  p_note text default null
)
returns public.seller_payouts
language plpgsql
security definer
set search_path=''
as $function$
declare
  v public.seller_payouts%rowtype;
  v_currency text;
  v_currency_count int;
  v_gross numeric(14,2);
  v_commission numeric(14,2);
  v_net numeric(14,2);
  v_count int;
  v_number text;
begin
  if not app_private.has_staff_permission('finance.manage') and app_private.staff_role()<>'SUPER_ADMIN' then raise exception 'ERP_FORBIDDEN'; end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then raise exception 'INVALID_PERIOD'; end if;
  if p_payment_method not in ('mobile_money','bank','cash','other') then raise exception 'INVALID_PAYMENT_METHOD'; end if;

  perform 1 from public.stores where id=p_store_id for update;
  if not found then raise exception 'STORE_NOT_FOUND'; end if;

  perform 1
  from public.seller_orders so
  where so.store_id=p_store_id
    and so.created_at>=p_period_start and so.created_at<=p_period_end
    and so.settlement_status='unsettled'
    and app_private.seller_order_is_payout_eligible(so.id)
    and not exists(
      select 1 from public.seller_payout_items pi
      join public.seller_payouts p on p.id=pi.payout_id
      where pi.seller_order_id=so.id and p.status in ('pending','approved','paid')
    )
  for update of so;

  select count(*),count(distinct so.currency),min(so.currency),
         coalesce(sum(so.subtotal),0),coalesce(sum(so.commission_amount),0),coalesce(sum(so.seller_net_amount),0)
  into v_count,v_currency_count,v_currency,v_gross,v_commission,v_net
  from public.seller_orders so
  where so.store_id=p_store_id
    and so.created_at>=p_period_start and so.created_at<=p_period_end
    and so.settlement_status='unsettled'
    and app_private.seller_order_is_payout_eligible(so.id)
    and not exists(
      select 1 from public.seller_payout_items pi
      join public.seller_payouts p on p.id=pi.payout_id
      where pi.seller_order_id=so.id and p.status in ('pending','approved','paid')
    );

  if v_count=0 then raise exception 'NO_ELIGIBLE_SELLER_ORDERS'; end if;
  if v_currency_count>1 then raise exception 'MULTI_CURRENCY_PAYOUT_NOT_SUPPORTED'; end if;

  loop
    v_number := 'OMP-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(select 1 from public.seller_payouts where payout_number=v_number);
  end loop;

  insert into public.seller_payouts(
    payout_number,store_id,period_start,period_end,gross_amount,commission_amount,net_amount,
    currency,payment_method,status,scheduled_at,note,created_by
  )
  values(
    v_number,p_store_id,p_period_start,p_period_end,v_gross,v_commission,v_net,
    coalesce(v_currency,'USD'),p_payment_method,'pending',now(),nullif(btrim(p_note),''),(select auth.uid())
  )
  returning * into v;

  insert into public.seller_payout_items(payout_id,seller_order_id,gross_amount,commission_amount,net_amount,currency)
  select v.id,so.id,so.subtotal,so.commission_amount,so.seller_net_amount,so.currency
  from public.seller_orders so
  where so.store_id=p_store_id
    and so.created_at>=p_period_start and so.created_at<=p_period_end
    and so.settlement_status='unsettled'
    and app_private.seller_order_is_payout_eligible(so.id)
    and not exists(
      select 1 from public.seller_payout_items pi
      join public.seller_payouts p on p.id=pi.payout_id
      where pi.seller_order_id=so.id and p.status in ('pending','approved','paid')
    );

  update public.seller_orders so
  set settlement_status='scheduled',updated_at=now()
  where exists(
    select 1 from public.seller_payout_items pi
    where pi.payout_id=v.id and pi.seller_order_id=so.id
  );

  perform app_private.write_audit(
    'seller_payout.create','seller_payout',v.id::text,null,to_jsonb(v),
    jsonb_build_object('order_count',v_count,'cod_remittance_required',true)
  );

  return v;
end;
$function$;

revoke all on function public.erp_create_seller_payout(uuid,timestamptz,timestamptz,text,text) from public,anon;
grant execute on function public.erp_create_seller_payout(uuid,timestamptz,timestamptz,text,text) to authenticated;

do $$
declare r record;
begin
  for r in select id from public.orders where status not in ('delivered','cancelled','failed','refused')
  loop
    perform app_private.reprice_order_delivery(r.id);
  end loop;
end $$;
