-- One Market currency standard:
-- merchandise, subscriptions, commissions and seller settlements use USD.
-- delivery fees remain CDF.

alter table public.delivery_subscription_plans
  rename column price_cdf to price_usd;

alter table public.delivery_subscription_plans
  alter column price_usd type numeric(12,2)
  using round(price_usd::numeric / 3000, 2);

comment on column public.delivery_subscription_plans.price_usd is
  'Subscription price in USD. Migrated from legacy CDF values at a fixed 3000 CDF/USD transition ratio; editable in ERP.';

alter table public.subscription_payments
  alter column currency set default 'USD';

update public.subscription_payments
set currency='USD'
where currency is distinct from 'USD';

do $$
begin
  if not exists (select 1 from pg_constraint where conname='stores_currency_usd_check') then
    alter table public.stores add constraint stores_currency_usd_check check (currency='USD');
  end if;
  if not exists (select 1 from pg_constraint where conname='products_currency_usd_check') then
    alter table public.products add constraint products_currency_usd_check check (currency='USD');
  end if;
  if not exists (select 1 from pg_constraint where conname='orders_currency_usd_check') then
    alter table public.orders add constraint orders_currency_usd_check check (currency='USD');
  end if;
  if not exists (select 1 from pg_constraint where conname='order_items_currency_usd_check') then
    alter table public.order_items add constraint order_items_currency_usd_check check (currency='USD');
  end if;
  if not exists (select 1 from pg_constraint where conname='seller_orders_currency_usd_check') then
    alter table public.seller_orders add constraint seller_orders_currency_usd_check check (currency='USD');
  end if;
  if not exists (select 1 from pg_constraint where conname='seller_orders_delivery_currency_cdf_check') then
    alter table public.seller_orders add constraint seller_orders_delivery_currency_cdf_check check (delivery_currency='CDF');
  end if;
  if not exists (select 1 from pg_constraint where conname='seller_payouts_currency_usd_check') then
    alter table public.seller_payouts add constraint seller_payouts_currency_usd_check check (currency='USD');
  end if;
  if not exists (select 1 from pg_constraint where conname='seller_payout_items_currency_usd_check') then
    alter table public.seller_payout_items add constraint seller_payout_items_currency_usd_check check (currency='USD');
  end if;
  if not exists (select 1 from pg_constraint where conname='subscription_payments_currency_usd_check') then
    alter table public.subscription_payments add constraint subscription_payments_currency_usd_check check (currency='USD');
  end if;
end $$;

drop function if exists public.erp_update_subscription_plan(uuid, integer, integer, integer, text);

create function public.erp_update_subscription_plan(
  p_plan_id uuid,
  p_price_usd numeric,
  p_standard_fee_cdf integer,
  p_express_fee_cdf integer,
  p_status text
)
returns public.delivery_subscription_plans
language plpgsql
security definer
set search_path=''
as $$
declare v public.delivery_subscription_plans%rowtype; b jsonb;
begin
  if app_private.staff_role()<>'SUPER_ADMIN' and not app_private.has_staff_permission('subscriptions.manage') then raise exception 'ERP_FORBIDDEN'; end if;
  if p_price_usd is null or p_price_usd<0 or p_standard_fee_cdf<0 or p_express_fee_cdf<0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_status not in ('coming_soon','active','retired') then raise exception 'INVALID_STATUS'; end if;
  select * into v from public.delivery_subscription_plans where id=p_plan_id for update;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;
  b:=to_jsonb(v);
  update public.delivery_subscription_plans
     set price_usd=round(p_price_usd,2),
         standard_fee_cdf=p_standard_fee_cdf,
         express_fee_cdf=p_express_fee_cdf,
         status=p_status,
         updated_at=now()
   where id=p_plan_id
   returning * into v;
  perform app_private.write_audit('subscription_plan.update','delivery_subscription_plan',p_plan_id::text,b,to_jsonb(v));
  return v;
end;
$$;

revoke all on function public.erp_update_subscription_plan(uuid,numeric,integer,integer,text) from public, anon;
grant execute on function public.erp_update_subscription_plan(uuid,numeric,integer,integer,text) to authenticated, service_role;

create or replace function public.erp_record_subscription_payment(
  p_subscription_id uuid,
  p_amount numeric,
  p_currency text default 'USD',
  p_payment_method text default 'mobile_money',
  p_payment_reference text default null,
  p_payment_status text default 'paid',
  p_note text default null
)
returns public.subscription_payments
language plpgsql
security definer
set search_path=''
as $$
declare v public.subscription_payments%rowtype; v_customer uuid;
begin
  if not app_private.has_staff_permission('subscriptions.manage')
     and not app_private.has_staff_permission('finance.manage')
     and app_private.staff_role()<>'SUPER_ADMIN' then raise exception 'ERP_FORBIDDEN'; end if;
  if p_amount is null or p_amount<0 then raise exception 'INVALID_AMOUNT'; end if;
  if upper(coalesce(nullif(btrim(p_currency),''),'USD'))<>'USD' then raise exception 'SUBSCRIPTION_CURRENCY_MUST_BE_USD'; end if;
  if p_payment_method not in ('mobile_money','bank','cash','other') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if p_payment_status not in ('pending','paid','failed','refunded') then raise exception 'INVALID_PAYMENT_STATUS'; end if;
  select customer_id into v_customer from public.customer_delivery_subscriptions where id=p_subscription_id;
  if v_customer is null then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  insert into public.subscription_payments(subscription_id,customer_id,amount,currency,payment_method,payment_reference,payment_status,paid_at,recorded_by,note)
  values(p_subscription_id,v_customer,round(p_amount,2),'USD',p_payment_method,nullif(btrim(p_payment_reference),''),p_payment_status,
         case when p_payment_status='paid' then now() else null end,(select auth.uid()),nullif(btrim(p_note),''))
  returning * into v;
  perform app_private.write_audit('subscription.payment_record','subscription_payment',v.id::text,null,to_jsonb(v));
  return v;
end;
$$;

create or replace function public.erp_subscription_overview()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_result jsonb;
begin
  if not app_private.has_staff_permission('subscriptions.view')
     and not app_private.has_staff_permission('finance.view')
     and app_private.staff_role()<>'SUPER_ADMIN' then raise exception 'ERP_FORBIDDEN'; end if;
  select jsonb_build_object(
    'metrics',jsonb_build_object(
      'active',coalesce((select count(*) from public.customer_delivery_subscriptions where status='active' and ends_at>now()),0),
      'pending',coalesce((select count(*) from public.customer_delivery_subscriptions where status='pending'),0),
      'expiring_soon',coalesce((select count(*) from public.customer_delivery_subscriptions where status='active' and ends_at between now() and now()+interval '7 days'),0),
      'expired',coalesce((select count(*) from public.customer_delivery_subscriptions where status='expired' or (status='active' and ends_at<=now())),0),
      'revenue_month_usd',coalesce((select sum(amount) from public.subscription_payments where payment_status='paid' and currency='USD' and paid_at>=date_trunc('month',now())),0),
      'revenue_total_usd',coalesce((select sum(amount) from public.subscription_payments where payment_status='paid' and currency='USD'),0)
    ),
    'subscriptions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'customer_id',s.customer_id,'customer_name',p.full_name,'customer_email',u.email,
        'plan_id',s.plan_id,'plan_name',pl.name,'plan_code',pl.code,'plan_price_usd',pl.price_usd,
        'status',s.status,'starts_at',s.starts_at,'ends_at',s.ends_at,'created_at',s.created_at,
        'last_payment',(select jsonb_build_object('id',sp.id,'amount',sp.amount,'currency',sp.currency,'payment_method',sp.payment_method,'payment_reference',sp.payment_reference,'payment_status',sp.payment_status,'paid_at',sp.paid_at,'created_at',sp.created_at)
                        from public.subscription_payments sp where sp.subscription_id=s.id order by sp.created_at desc limit 1)
      ) order by s.created_at desc)
      from public.customer_delivery_subscriptions s
      join public.delivery_subscription_plans pl on pl.id=s.plan_id
      left join public.profiles p on p.id=s.customer_id
      left join auth.users u on u.id=s.customer_id
    ),'[]'::jsonb),
    'plans',coalesce((select jsonb_agg(to_jsonb(pl) order by pl.duration_months) from public.delivery_subscription_plans pl),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.erp_finance_dashboard(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_from timestamptz := coalesce(p_from, date_trunc('day', now()) - interval '29 days');
  v_to timestamptz := coalesce(p_to, now());
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
      'seller_due_usd',coalesce((select sum(so.seller_net_amount) from public.seller_orders so join public.orders o on o.id=so.order_id where so.status='delivered' and so.currency='USD' and o.payment_status in ('paid','cash_received') and so.settlement_status<>'paid'),0),
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
        select date_trunc('day',o.created_at) bucket,count(*) order_count,
               sum(case when o.currency='USD' and o.status not in ('cancelled','failed','refused') then o.items_total else 0 end) sales,
               sum(coalesce((select sum(so.commission_amount) from public.seller_orders so where so.order_id=o.id and so.status='delivered' and so.currency='USD'),0)) commissions
        from public.orders o where o.created_at between v_from and v_to group by date_trunc('day',o.created_at)
      ) x on x.bucket=g.bucket
    ),'[]'::jsonb),
    'top_stores',coalesce((
      select jsonb_agg(q.row_data order by (q.row_data->>'sales_usd')::numeric desc)
      from (
        select jsonb_build_object('store_id',s.id,'name',s.name,
          'sales_usd',coalesce(sum(so.subtotal) filter(where so.status='delivered' and so.currency='USD'),0),
          'commissions_usd',coalesce(sum(so.commission_amount) filter(where so.status='delivered' and so.currency='USD'),0)) row_data
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
$$;
