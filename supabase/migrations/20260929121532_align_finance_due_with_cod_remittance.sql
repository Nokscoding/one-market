
create or replace function public.erp_stores_overview(
  p_search text default null,p_status text default null,p_limit integer default 100,p_offset integer default 0
)
returns setof jsonb
language plpgsql
security definer
set search_path=''
as $function$
begin
  if not app_private.has_staff_permission('stores.view') and app_private.staff_role()<>'SUPER_ADMIN' then raise exception 'ERP_FORBIDDEN'; end if;
  return query select jsonb_build_object(
    'id',s.id,'name',s.name,'slug',s.slug,'logo_url',s.logo_url,'city',s.city,'status',s.status,'is_verified',s.is_verified,'is_partner',s.is_partner,'created_at',s.created_at,
    'owner_id',s.owner_id,'owner_name',p.full_name,'owner_email',u.email,
    'product_count',(select count(*) from public.products pr where pr.store_id=s.id),
    'order_count',(select count(*) from public.seller_orders so where so.store_id=s.id),
    'sales_usd',coalesce((select sum(so.subtotal) from public.seller_orders so where so.store_id=s.id and so.status='delivered' and so.currency='USD'),0),
    'commission_percent',app_private.effective_store_commission(s.id),
    'commission_source',case when exists(select 1 from public.store_commission_rates r where r.store_id=s.id) then 'custom' else 'global' end,
    'seller_due_usd',coalesce((
      select sum(so.seller_net_amount)
      from public.seller_orders so
      where so.store_id=s.id
        and so.currency='USD'
        and so.settlement_status='unsettled'
        and app_private.seller_order_is_payout_eligible(so.id)
    ),0)
  )
  from public.stores s
  left join public.profiles p on p.id=s.owner_id
  left join auth.users u on u.id=s.owner_id
  where (nullif(btrim(p_search),'') is null or s.name ilike '%'||btrim(p_search)||'%' or coalesce(s.city,'') ilike '%'||btrim(p_search)||'%' or coalesce(p.full_name,'') ilike '%'||btrim(p_search)||'%' or coalesce(u.email,'') ilike '%'||btrim(p_search)||'%')
    and (nullif(btrim(p_status),'') is null or s.status=p_status)
  order by s.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),250))
  offset greatest(coalesce(p_offset,0),0);
end;
$function$;

create or replace function public.erp_store_financials(
  p_store_id uuid,p_from timestamptz default null,p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_from timestamptz:=coalesce(p_from,date_trunc('day',now())-interval '29 days');
  v_to timestamptz:=coalesce(p_to,now());
  v_result jsonb;
begin
  if not app_private.has_staff_permission('finance.view') and app_private.staff_role()<>'SUPER_ADMIN' then raise exception 'ERP_FORBIDDEN'; end if;
  if not exists(select 1 from public.stores where id=p_store_id) then raise exception 'STORE_NOT_FOUND'; end if;
  if v_to<v_from then raise exception 'INVALID_PERIOD'; end if;
  select jsonb_build_object(
    'effective_commission',app_private.effective_store_commission(p_store_id),
    'commission_source',case when exists(select 1 from public.store_commission_rates r where r.store_id=p_store_id) then 'custom' else 'global' end,
    'commission_override',(select jsonb_build_object('percent',r.commission_percent,'updated_at',r.updated_at,'updated_by',r.updated_by,'updated_by_name',p.full_name) from public.store_commission_rates r left join public.profiles p on p.id=r.updated_by where r.store_id=p_store_id),
    'metrics',jsonb_build_object(
      'gross_sales_usd',coalesce((select sum(so.subtotal) from public.seller_orders so where so.store_id=p_store_id and so.created_at between v_from and v_to and so.status not in ('cancelled','refused','failed')),0),
      'delivered_sales_usd',coalesce((select sum(so.subtotal) from public.seller_orders so where so.store_id=p_store_id and so.created_at between v_from and v_to and so.status='delivered'),0),
      'orders',coalesce((select count(*) from public.seller_orders so where so.store_id=p_store_id and so.created_at between v_from and v_to),0),
      'delivered_orders',coalesce((select count(*) from public.seller_orders so where so.store_id=p_store_id and so.created_at between v_from and v_to and so.status='delivered'),0),
      'average_order_usd',coalesce((select avg(so.subtotal) from public.seller_orders so where so.store_id=p_store_id and so.created_at between v_from and v_to and so.status not in ('cancelled','refused','failed')),0),
      'commission_generated_usd',coalesce((select sum(so.commission_amount) from public.seller_orders so where so.store_id=p_store_id and so.created_at between v_from and v_to and so.status='delivered'),0),
      'seller_earnings_usd',coalesce((select sum(so.seller_net_amount) from public.seller_orders so where so.store_id=p_store_id and so.created_at between v_from and v_to and so.status='delivered'),0),
      'seller_paid_usd',coalesce((select sum(p.net_amount) from public.seller_payouts p where p.store_id=p_store_id and p.status='paid' and p.paid_at between v_from and v_to and p.currency='USD'),0),
      'seller_due_usd',coalesce((
        select sum(so.seller_net_amount)
        from public.seller_orders so
        where so.store_id=p_store_id
          and so.settlement_status='unsettled'
          and app_private.seller_order_is_payout_eligible(so.id)
      ),0),
      'cancelled_orders',coalesce((select count(*) from public.seller_orders so where so.store_id=p_store_id and so.created_at between v_from and v_to and so.status in ('cancelled','refused','failed')),0)
    ),
    'transactions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'seller_order_id',so.id,'order_id',so.order_id,'number',so.seller_order_number,'date',so.created_at,'status',so.status,
        'gross',so.subtotal,'commission_percent',so.commission_percent,'commission',so.commission_amount,'seller_net',so.seller_net_amount,
        'currency',so.currency,'settlement_status',so.settlement_status,'payment_method',o.payment_method,'payment_status',o.payment_status
      ) order by so.created_at desc)
      from public.seller_orders so
      join public.orders o on o.id=so.order_id
      where so.store_id=p_store_id and so.created_at between v_from and v_to
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

create or replace function public.erp_finance_dashboard(p_from timestamptz default null,p_to timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_from timestamptz:=coalesce(p_from,date_trunc('day',now())-interval '29 days');
  v_to timestamptz:=coalesce(p_to,now());
  v_result jsonb;
begin
  if not app_private.has_staff_permission('finance.view') and app_private.staff_role()<>'SUPER_ADMIN' then raise exception 'ERP_FORBIDDEN'; end if;
  if v_to<v_from then raise exception 'INVALID_PERIOD'; end if;

  select jsonb_build_object(
    'period',jsonb_build_object('from',v_from,'to',v_to),
    'metrics',jsonb_build_object(
      'gmv_usd',coalesce((select sum(o.items_total) from public.orders o where o.created_at between v_from and v_to and o.currency='USD' and o.status not in ('cancelled','failed','refused')),0),
      'orders',coalesce((select count(*) from public.orders o where o.created_at between v_from and v_to),0),
      'delivered_orders',coalesce((select count(*) from public.orders o where o.created_at between v_from and v_to and o.status='delivered'),0),
      'average_order_usd',coalesce((select avg(o.items_total) from public.orders o where o.created_at between v_from and v_to and o.currency='USD' and o.status not in ('cancelled','failed','refused')),0),
      'active_stores',coalesce((select count(*) from public.stores s where s.status='active'),0),
      'new_sellers',coalesce((select count(*) from public.seller_applications sa where sa.created_at between v_from and v_to),0),
      'new_customers',coalesce((select count(*) from public.profiles p where p.created_at between v_from and v_to and p.role='client'),0),
      'commissions_generated_usd',coalesce((select sum(so.commission_amount) from public.seller_orders so where so.created_at between v_from and v_to and so.status='delivered' and so.currency='USD'),0),
      'commissions_collected_usd',coalesce((select sum(so.commission_amount) from public.seller_orders so join public.orders o on o.id=so.order_id where so.created_at between v_from and v_to and so.status='delivered' and so.currency='USD' and o.payment_status in ('paid','cash_received')),0),
      'seller_due_usd',coalesce((
        select sum(so.seller_net_amount)
        from public.seller_orders so
        where so.currency='USD'
          and so.settlement_status='unsettled'
          and app_private.seller_order_is_payout_eligible(so.id)
      ),0),
      'seller_paid_usd',coalesce((select sum(p.net_amount) from public.seller_payouts p where p.status='paid' and p.paid_at between v_from and v_to and p.currency='USD'),0),
      'payouts_pending',coalesce((select count(*) from public.seller_payouts p where p.status in ('pending','approved')),0),
      'subscription_revenue_usd',coalesce((select sum(sp.amount) from public.subscription_payments sp where sp.payment_status='paid' and sp.currency='USD' and sp.paid_at between v_from and v_to),0),
      'delivery_revenue_cdf',coalesce((select sum(o.delivery_fee_cdf) from public.orders o where o.status='delivered' and o.payment_status in ('paid','cash_received') and o.created_at between v_from and v_to),0),
      'cod_pending',coalesce((select count(*) from public.orders o where o.payment_method='cod' and o.payment_status='pending_on_delivery'),0),
      'mobile_pending',coalesce((select count(*) from public.orders o where o.payment_method='mobile_money' and o.payment_status in ('awaiting_mobile_money','payment_submitted')),0),
      'mobile_paid',coalesce((select count(*) from public.orders o where o.payment_method='mobile_money' and o.payment_status='paid' and o.created_at between v_from and v_to),0),
      'payment_problems',coalesce((select count(*) from public.orders o where o.created_at between v_from and v_to and (o.payment_status='cancelled' or o.status='failed')),0)
    ),
    'series',coalesce((
      select jsonb_agg(jsonb_build_object('date',g.bucket,'sales_usd',coalesce(x.sales,0),'commissions_usd',coalesce(x.commissions,0),'orders',coalesce(x.order_count,0)) order by g.bucket)
      from generate_series(date_trunc('day',v_from),date_trunc('day',v_to),interval '1 day') as g(bucket)
      left join (
        select date_trunc('day',o.created_at) as bucket,count(*) as order_count,
          sum(case when o.currency='USD' and o.status not in ('cancelled','failed','refused') then o.items_total else 0 end) as sales,
          sum(coalesce((select sum(so.commission_amount) from public.seller_orders so where so.order_id=o.id and so.status='delivered' and so.currency='USD'),0)) as commissions
        from public.orders o where o.created_at between v_from and v_to group by date_trunc('day',o.created_at)
      ) x on x.bucket=g.bucket
    ),'[]'::jsonb),
    'top_stores',coalesce((
      select jsonb_agg(q.row_data order by (q.row_data->>'sales_usd')::numeric desc)
      from (
        select jsonb_build_object('store_id',s.id,'name',s.name,
          'sales_usd',coalesce(sum(so.subtotal) filter(where so.status='delivered' and so.currency='USD'),0),
          'commissions_usd',coalesce(sum(so.commission_amount) filter(where so.status='delivered' and so.currency='USD'),0)
        ) as row_data
        from public.stores s
        left join public.seller_orders so on so.store_id=s.id and so.created_at between v_from and v_to
        group by s.id,s.name
        order by coalesce(sum(so.subtotal) filter(where so.status='delivered' and so.currency='USD'),0) desc
        limit 8
      ) q
    ),'[]'::jsonb),
    'payment_methods',jsonb_build_array(
      jsonb_build_object('method','cod','count',coalesce((select count(*) from public.orders o where o.created_at between v_from and v_to and o.payment_method='cod'),0)),
      jsonb_build_object('method','mobile_money','count',coalesce((select count(*) from public.orders o where o.created_at between v_from and v_to and o.payment_method='mobile_money'),0))
    )
  ) into v_result;
  return v_result;
end;
$function$;
