
drop function if exists public.erp_list_couriers();

create function public.erp_list_couriers()
returns table(
  user_id uuid,employee_code text,full_name text,email text,phone text,
  vehicle_type text,vehicle_label text,status text,is_available boolean,
  country_code text,city text,active_assignments bigint,last_login_at timestamptz
)
language sql
security definer
set search_path=''
as $function$
  select
    c.user_id,c.employee_code,coalesce(s.full_name,p.full_name,'Livreur One Market') as full_name,
    u.email::text,coalesce(c.phone,p.phone),c.vehicle_type,c.vehicle_label,c.status,c.is_available,
    c.country_code,c.city,
    (select count(*) from public.delivery_assignments da
      where da.courier_user_id=c.user_id and da.status not in ('delivered','cancelled')) as active_assignments,
    s.last_login_at
  from public.courier_profiles c
  join public.admin_staff s on s.user_id=c.user_id and s.staff_role='COURIER'
  join public.profiles p on p.id=c.user_id
  join auth.users u on u.id=c.user_id
  where app_private.has_staff_permission('delivery.manage') or app_private.staff_role()='SUPER_ADMIN'
  order by (c.status='active') desc,coalesce(s.full_name,p.full_name,'Livreur One Market');
$function$;

revoke all on function public.erp_list_couriers() from public,anon;
grant execute on function public.erp_list_couriers() to authenticated;

create or replace function public.erp_set_courier_location(p_user_id uuid,p_country_code text,p_city text)
returns public.courier_profiles
language plpgsql
security definer
set search_path=''
as $function$
declare v public.courier_profiles%rowtype;
begin
  if not app_private.has_staff_permission('delivery.manage') and app_private.staff_role()<>'SUPER_ADMIN' then
    raise exception 'ERP_FORBIDDEN';
  end if;
  if upper(coalesce(p_country_code,'')) not in ('CD','US') then raise exception 'COUNTRY_NOT_SUPPORTED'; end if;
  if nullif(btrim(coalesce(p_city,'')),'') is null then raise exception 'CITY_REQUIRED'; end if;
  update public.courier_profiles
  set country_code=upper(p_country_code),city=btrim(p_city),updated_at=now()
  where user_id=p_user_id
  returning * into v;
  if not found then raise exception 'COURIER_NOT_FOUND'; end if;
  perform app_private.write_audit('courier.location','courier',p_user_id::text,null,to_jsonb(v));
  return v;
end;
$function$;

revoke all on function public.erp_set_courier_location(uuid,text,text) from public,anon;
grant execute on function public.erp_set_courier_location(uuid,text,text) to authenticated;

create or replace function public.courier_my_deliveries()
returns setof jsonb
language sql
security definer
set search_path=''
as $function$
  select jsonb_build_object(
    'assignment_id',da.id,
    'assignment_status',da.status,
    'previous_status',da.previous_status,
    'collection_status',da.collection_status,
    'product_cash_collected_usd',da.product_cash_collected_usd,
    'delivery_fee_collected_cdf',da.delivery_fee_collected_cdf,
    'courier_earning_cdf',da.courier_earning_cdf,
    'assigned_at',da.assigned_at,
    'accepted_at',da.accepted_at,
    'picked_up_at',da.picked_up_at,
    'out_for_delivery_at',da.out_for_delivery_at,
    'delivered_at',da.delivered_at,
    'remitted_at',da.remitted_at,
    'order_id',o.id,
    'order_number',o.order_number,
    'order_status',o.status,
    'logistics_status',o.logistics_status,
    'payment_method',o.payment_method,
    'payment_status',o.payment_status,
    'items_total_usd',o.items_total,
    'delivery_fee_cdf',o.delivery_fee_cdf,
    'delivery_method',o.delivery_method,
    'customer_note',o.customer_note,
    'is_intercity',o.is_intercity,
    'origin_cities',o.origin_cities,
    'destination_city',o.destination_city,
    'estimated_delivery_min_days',o.estimated_delivery_min_days,
    'estimated_delivery_max_days',o.estimated_delivery_max_days,
    'shipping',o.shipping_snapshot,
    'items',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',oi.id,'seller_order_id',oi.seller_order_id,'name',oi.product_name,
        'image_url',oi.product_image_url,'variant',oi.variant_snapshot,'quantity',oi.quantity,'store_id',oi.store_id
      ) order by oi.created_at),'[]'::jsonb)
      from public.order_items oi where oi.order_id=o.id
    ),
    'pickups',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'seller_order_id',so.id,'seller_order_number',so.seller_order_number,'seller_status',so.status,
        'store_id',s.id,'store_name',s.name,'contact_name',sp.contact_name,'phone',coalesce(sp.phone,s.phone),
        'address_line',sp.address_line,'district',sp.district,'city',coalesce(sp.city,s.city),
        'landmark',sp.landmark,'instructions',sp.instructions,'latitude',sp.latitude,'longitude',sp.longitude,
        'pickup_verified',pc.verified_assignment_id=da.id and pc.verified_by=(select auth.uid()) and pc.verified_at is not null,
        'verified_at',case when pc.verified_assignment_id=da.id and pc.verified_by=(select auth.uid()) then pc.verified_at else null end,
        'items',(select coalesce(jsonb_agg(jsonb_build_object(
          'id',oi.id,'name',oi.product_name,'image_url',oi.product_image_url,'variant',oi.variant_snapshot,'quantity',oi.quantity
        ) order by oi.created_at),'[]'::jsonb) from public.order_items oi where oi.seller_order_id=so.id)
      ) order by so.created_at),'[]'::jsonb)
      from public.seller_orders so
      join public.stores s on s.id=so.store_id
      left join public.store_pickup_points sp on sp.store_id=s.id
      left join public.seller_order_pickup_codes pc on pc.seller_order_id=so.id
      where so.order_id=o.id and so.status not in ('cancelled','refused','failed')
    ),
    'verified_pickups',(
      select count(*) from public.seller_orders so
      join public.seller_order_pickup_codes pc on pc.seller_order_id=so.id
      where so.order_id=o.id and so.status='ready'
        and pc.verified_assignment_id=da.id and pc.verified_by=(select auth.uid()) and pc.verified_at is not null
    ),
    'total_pickups',(
      select count(*) from public.seller_orders so
      where so.order_id=o.id and so.status not in ('cancelled','refused','failed')
    ),
    'open_incidents',(
      select count(*) from public.delivery_incidents di
      where di.assignment_id=da.id and di.status='open'
    )
  )
  from public.delivery_assignments da
  join public.orders o on o.id=da.order_id
  where da.courier_user_id=(select auth.uid())
    and app_private.is_active_courier((select auth.uid()))
    and da.status<>'cancelled'
  order by
    case da.status when 'out_for_delivery' then 1 when 'picked_up' then 2 when 'picking_up' then 3
      when 'accepted' then 4 when 'assigned' then 5 when 'problem' then 6 when 'delivered' then 7 else 8 end,
    da.assigned_at desc;
$function$;

revoke all on function public.courier_my_deliveries() from public,anon;
grant execute on function public.courier_my_deliveries() to authenticated;

create or replace function app_private.try_auto_assign_delivery(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_order public.orders%rowtype;
  v_courier uuid;
  v_assignment public.delivery_assignments%rowtype;
  v_missing_pickup boolean;
  v_settings jsonb := '{}'::jsonb;
  v_earning integer := 0;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then return false; end if;
  if v_order.status in ('delivered','partially_completed','cancelled','refused','failed') then return false; end if;
  if v_order.payment_status='cancelled' or (v_order.payment_method='mobile_money' and v_order.payment_status<>'paid') then return false; end if;
  if v_order.is_intercity and v_order.logistics_status<>'arrived_destination' then return false; end if;
  if not exists(select 1 from public.seller_orders so where so.order_id=p_order_id and so.status not in ('refused','cancelled','failed')) then return false; end if;
  if exists(select 1 from public.seller_orders so where so.order_id=p_order_id and so.status not in ('refused','cancelled','failed','ready')) then return false; end if;
  if exists(select 1 from public.delivery_assignments da where da.order_id=p_order_id and da.status<>'cancelled') then return true; end if;

  select exists(
    select 1 from public.seller_orders so
    left join public.store_pickup_points sp on sp.store_id=so.store_id
    where so.order_id=p_order_id and so.status='ready'
      and (sp.store_id is null or nullif(btrim(sp.address_line),'') is null or nullif(btrim(sp.phone),'') is null)
  ) into v_missing_pickup;

  if v_missing_pickup then
    perform app_private.notify_dispatch_attention(p_order_id,'pickup_missing');
    return false;
  end if;

  select c.user_id into v_courier
  from public.courier_profiles c
  join public.admin_staff s on s.user_id=c.user_id
  join public.profiles p on p.id=c.user_id
  where c.status='active' and c.is_available=true
    and s.staff_role='COURIER' and s.status='active' and p.account_status='active'
    and (nullif(btrim(c.city),'') is null or nullif(btrim(v_order.destination_city),'') is null or lower(btrim(c.city))=lower(btrim(v_order.destination_city)))
    and (c.country_code is null or v_order.destination_country_code is null or c.country_code=v_order.destination_country_code)
  order by
    (select count(*) from public.delivery_assignments da where da.courier_user_id=c.user_id and da.status not in ('delivered','cancelled')) asc,
    (select max(da.assigned_at) from public.delivery_assignments da where da.courier_user_id=c.user_id) asc nulls first,
    c.hired_at asc
  for update of c skip locked
  limit 1;

  if v_courier is null then
    perform app_private.notify_dispatch_attention(p_order_id,'no_courier');
    return false;
  end if;

  select coalesce(value,'{}'::jsonb) into v_settings from public.marketplace_settings where key='logistics';
  v_earning := case when v_order.delivery_method='express'
    then coalesce((v_settings->>'courier_express_earning_cdf')::integer,7000)
    else coalesce((v_settings->>'courier_standard_earning_cdf')::integer,3000) end;

  insert into public.delivery_assignments(
    order_id,courier_user_id,status,collection_status,assigned_by,assigned_at,assignment_source,courier_earning_cdf
  )
  values(p_order_id,v_courier,'assigned','not_collected',null,now(),'auto',greatest(0,v_earning))
  on conflict(order_id) do update set
    courier_user_id=excluded.courier_user_id,status='assigned',previous_status=null,collection_status='not_collected',
    product_cash_collected_usd=0,delivery_fee_collected_cdf=0,courier_earning_cdf=excluded.courier_earning_cdf,
    assigned_by=null,assigned_at=now(),accepted_at=null,picked_up_at=null,out_for_delivery_at=null,
    delivered_at=null,remitted_at=null,assignment_source='auto',updated_at=now()
  where public.delivery_assignments.status='cancelled'
  returning * into v_assignment;

  if v_assignment.id is null then
    return exists(select 1 from public.delivery_assignments where order_id=p_order_id and status<>'cancelled');
  end if;

  insert into public.notifications(user_id,title,body,type,link)
  values(v_courier,'Nouvelle course One Market',
    'La commande '||v_order.order_number||' est prête. Ramassage boutique puis livraison client.',
    'delivery','/courier');

  if v_order.customer_id is not null then
    insert into public.notifications(user_id,title,body,type,link)
    values(v_order.customer_id,'Livreur One Market assigné',
      'Un livreur a été affecté à votre commande '||v_order.order_number||'. Il va d’abord récupérer les articles auprès de la boutique.',
      'order','/orders/'||p_order_id::text);
  end if;

  insert into public.order_status_events(order_id,status,label)
  values(p_order_id,'ready','Commande prête · un livreur One Market a été assigné');

  return true;
end;
$function$;
