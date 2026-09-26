-- One Market final polish — ranking, promo codes, checkout V2 and chat/RLS hardening.
-- Generated from the live schema after successful production migration on 2026-09-26.

create table if not exists public.product_rank_stats (
  product_id uuid primary key references public.products(id) on delete cascade,
  order_quantity bigint not null default 0 check (order_quantity >= 0),
  search_hits bigint not null default 0 check (search_hits >= 0),
  last_ordered_at timestamptz,
  last_searched_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.product_rank_stats enable row level security;
drop policy if exists product_rank_stats_public_read on public.product_rank_stats;
create policy product_rank_stats_public_read on public.product_rank_stats for select to anon,authenticated using (true);
revoke all on table public.product_rank_stats from anon,authenticated;
grant select on table public.product_rank_stats to anon,authenticated;

create table if not exists public.product_search_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  search_query text not null check (char_length(btrim(search_query)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index if not exists product_search_events_product_created_idx on public.product_search_events(product_id,created_at desc);
create index if not exists product_search_events_user_created_idx on public.product_search_events(user_id,created_at desc) where user_id is not null;
alter table public.product_search_events enable row level security;
drop policy if exists product_search_events_insert_public on public.product_search_events;
create policy product_search_events_insert_public on public.product_search_events for insert to anon,authenticated
with check (
  ((((select auth.uid()) is null) and user_id is null) or user_id=(select auth.uid()))
  and exists (
    select 1 from public.products p join public.stores s on s.id=p.store_id
    where p.id=product_search_events.product_id and p.is_active=true and p.is_demo=false
      and s.status='active' and s.is_demo=false and s.country_code='CD'
  )
);
revoke all on table public.product_search_events from anon,authenticated;
grant insert on table public.product_search_events to anon,authenticated;

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null check (char_length(code) between 3 and 32),
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  max_discount_usd numeric(12,2) check (max_discount_usd is null or max_discount_usd >= 0),
  min_order_usd numeric(12,2) not null default 0 check (min_order_usd >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0),
  times_redeemed integer not null default 0 check (times_redeemed >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (discount_type <> 'percent' or discount_value <= 100)
);
create unique index if not exists promo_codes_upper_code_key on public.promo_codes((upper(btrim(code))));
alter table public.promo_codes enable row level security;
drop policy if exists promo_codes_finance_read on public.promo_codes;
create policy promo_codes_finance_read on public.promo_codes for select to authenticated
using (app_private.has_staff_permission('finance.manage'));
revoke all on table public.promo_codes from anon,authenticated;
grant select on table public.promo_codes to authenticated;

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  discount_total_usd numeric(12,2) not null check (discount_total_usd >= 0),
  created_at timestamptz not null default now(),
  unique(order_id)
);
create index if not exists promo_redemptions_code_user_idx on public.promo_redemptions(promo_code_id,user_id,created_at desc);
alter table public.promo_redemptions enable row level security;
drop policy if exists promo_redemptions_finance_read on public.promo_redemptions;
create policy promo_redemptions_finance_read on public.promo_redemptions for select to authenticated
using (app_private.has_staff_permission('finance.manage'));
revoke all on table public.promo_redemptions from anon,authenticated;
grant select on table public.promo_redemptions to authenticated;

alter table public.orders add column if not exists promo_code_id uuid references public.promo_codes(id) on delete set null;
alter table public.orders add column if not exists promo_code text;
alter table public.orders add column if not exists discount_total numeric(12,2) not null default 0;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='orders_discount_total_check' and conrelid='public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_discount_total_check check (discount_total >= 0);
  end if;
end
$$;

CREATE OR REPLACE FUNCTION app_private.apply_promo_to_order(p_order_id uuid, p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_order public.orders%rowtype;
  v_promo public.promo_codes%rowtype;
  v_user_uses integer := 0;
  v_discount numeric(12,2) := 0;
begin
  if v_code = '' then
    return;
  end if;
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_order
  from public.orders
  where id = p_order_id and customer_id = v_user
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.currency <> 'USD' then raise exception 'PROMO_CURRENCY_UNSUPPORTED'; end if;
  if v_order.promo_code_id is not null then raise exception 'PROMO_ALREADY_APPLIED'; end if;

  select * into v_promo
  from public.promo_codes
  where upper(btrim(code)) = v_code
  for update;

  if not found then raise exception 'PROMO_NOT_FOUND'; end if;
  if not v_promo.is_active then raise exception 'PROMO_INACTIVE'; end if;
  if v_promo.starts_at is not null and now() < v_promo.starts_at then raise exception 'PROMO_NOT_STARTED'; end if;
  if v_promo.ends_at is not null and now() >= v_promo.ends_at then raise exception 'PROMO_EXPIRED'; end if;
  if v_order.items_total < v_promo.min_order_usd then raise exception 'PROMO_MIN_ORDER'; end if;
  if v_promo.usage_limit is not null and v_promo.times_redeemed >= v_promo.usage_limit then raise exception 'PROMO_USAGE_LIMIT'; end if;

  select count(*)::integer into v_user_uses
  from public.promo_redemptions
  where promo_code_id = v_promo.id and user_id = v_user;

  if v_user_uses >= v_promo.per_user_limit then raise exception 'PROMO_USER_LIMIT'; end if;

  if v_promo.discount_type = 'percent' then
    v_discount := round(v_order.items_total * v_promo.discount_value / 100.0, 2);
    if v_promo.max_discount_usd is not null then
      v_discount := least(v_discount, v_promo.max_discount_usd);
    end if;
  else
    v_discount := least(v_promo.discount_value, v_order.items_total);
  end if;

  v_discount := greatest(0, least(v_discount, v_order.items_total));

  update public.orders
  set promo_code_id = v_promo.id,
      promo_code = v_code,
      discount_total = v_discount,
      grand_total = greatest(items_total - v_discount + delivery_total, 0),
      updated_at = now()
  where id = p_order_id;

  insert into public.promo_redemptions(
    promo_code_id, user_id, order_id, discount_total_usd
  )
  values(v_promo.id, v_user, p_order_id, v_discount);

  update public.promo_codes
  set times_redeemed = times_redeemed + 1,
      updated_at = now()
  where id = v_promo.id;
end;
$function$;

CREATE OR REPLACE FUNCTION app_private.bump_product_search_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.product_rank_stats(product_id, search_hits, last_searched_at, updated_at)
  values(new.product_id, 1, now(), now())
  on conflict (product_id) do update
    set search_hits = public.product_rank_stats.search_hits + 1,
        last_searched_at = now(),
        updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION app_private.checkout_buy_now_v2_impl(p_product_id uuid, p_product_variant_id uuid, p_quantity integer, p_address_id uuid, p_customer_note text DEFAULT NULL::text, p_payment_method text DEFAULT 'cod'::text, p_delivery_method text DEFAULT 'standard'::text, p_promo_code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order uuid;
begin
  v_order := app_private.checkout_buy_now_impl(
    p_product_id, p_product_variant_id, p_quantity, p_address_id,
    p_customer_note, p_payment_method, p_delivery_method
  );
  perform app_private.apply_promo_to_order(v_order, p_promo_code);
  return v_order;
end;
$function$;

CREATE OR REPLACE FUNCTION app_private.checkout_cart_v2_impl(p_address_id uuid, p_customer_note text DEFAULT NULL::text, p_delivery_method text DEFAULT 'standard'::text, p_payment_method text DEFAULT 'cod'::text, p_promo_code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order uuid;
begin
  v_order := app_private.checkout_cart_impl(
    p_address_id, p_customer_note, p_delivery_method, p_payment_method
  );
  perform app_private.apply_promo_to_order(v_order, p_promo_code);
  return v_order;
end;
$function$;

CREATE OR REPLACE FUNCTION app_private.erp_list_promo_codes_impl()
 RETURNS TABLE(id uuid, code text, discount_type text, discount_value numeric, max_discount_usd numeric, min_order_usd numeric, starts_at timestamp with time zone, ends_at timestamp with time zone, usage_limit integer, per_user_limit integer, times_redeemed integer, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not app_private.has_staff_permission('finance.manage') then
    raise exception 'ERP_FORBIDDEN';
  end if;

  return query
  select
    p.id, p.code, p.discount_type, p.discount_value, p.max_discount_usd,
    p.min_order_usd, p.starts_at, p.ends_at, p.usage_limit,
    p.per_user_limit, p.times_redeemed, p.is_active, p.created_at, p.updated_at
  from public.promo_codes p
  order by p.created_at desc;
end;
$function$;

CREATE OR REPLACE FUNCTION app_private.erp_set_promo_code_active_impl(p_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not app_private.has_staff_permission('finance.manage') then
    raise exception 'ERP_FORBIDDEN';
  end if;

  update public.promo_codes
  set is_active = coalesce(p_active,false), updated_at = now()
  where id = p_id;

  if not found then raise exception 'PROMO_NOT_FOUND'; end if;
end;
$function$;

CREATE OR REPLACE FUNCTION app_private.erp_upsert_promo_code_impl(p_id uuid, p_code text, p_discount_type text, p_discount_value numeric, p_max_discount_usd numeric, p_min_order_usd numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_usage_limit integer, p_per_user_limit integer, p_is_active boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if not app_private.has_staff_permission('finance.manage') then
    raise exception 'ERP_FORBIDDEN';
  end if;

  if v_code !~ '^[A-Z0-9_-]{3,32}$' then raise exception 'PROMO_CODE_FORMAT'; end if;
  if p_discount_type not in ('percent','fixed') then raise exception 'PROMO_TYPE_INVALID'; end if;
  if p_discount_value is null or p_discount_value <= 0 then raise exception 'PROMO_VALUE_INVALID'; end if;
  if p_discount_type = 'percent' and p_discount_value > 100 then raise exception 'PROMO_VALUE_INVALID'; end if;
  if coalesce(p_min_order_usd,0) < 0 then raise exception 'PROMO_MIN_INVALID'; end if;
  if p_max_discount_usd is not null and p_max_discount_usd < 0 then raise exception 'PROMO_MAX_INVALID'; end if;
  if p_usage_limit is not null and p_usage_limit < 1 then raise exception 'PROMO_LIMIT_INVALID'; end if;
  if coalesce(p_per_user_limit,1) < 1 then raise exception 'PROMO_USER_LIMIT_INVALID'; end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'PROMO_DATES_INVALID'; end if;

  if p_id is null then
    insert into public.promo_codes(
      code, discount_type, discount_value, max_discount_usd, min_order_usd,
      starts_at, ends_at, usage_limit, per_user_limit, is_active, created_by
    )
    values(
      v_code, p_discount_type, p_discount_value, p_max_discount_usd,
      coalesce(p_min_order_usd,0), p_starts_at, p_ends_at, p_usage_limit,
      coalesce(p_per_user_limit,1), coalesce(p_is_active,true), (select auth.uid())
    )
    returning id into v_id;
  else
    update public.promo_codes
    set code = v_code,
        discount_type = p_discount_type,
        discount_value = p_discount_value,
        max_discount_usd = p_max_discount_usd,
        min_order_usd = coalesce(p_min_order_usd,0),
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        usage_limit = p_usage_limit,
        per_user_limit = coalesce(p_per_user_limit,1),
        is_active = coalesce(p_is_active,true),
        updated_at = now()
    where id = p_id
    returning id into v_id;

    if v_id is null then raise exception 'PROMO_NOT_FOUND'; end if;
  end if;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION app_private.order_item_refresh_product_rank()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' then
    perform app_private.refresh_product_order_stats(old.product_id);
    return old;
  end if;

  perform app_private.refresh_product_order_stats(new.product_id);

  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform app_private.refresh_product_order_stats(old.product_id);
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION app_private.order_status_refresh_product_rank()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_product_id uuid;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  for v_product_id in
    select distinct oi.product_id
    from public.order_items oi
    where oi.order_id = new.id and oi.product_id is not null
  loop
    perform app_private.refresh_product_order_stats(v_product_id);
  end loop;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION app_private.promo_quote_impl(p_code text, p_items_total numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_promo public.promo_codes%rowtype;
  v_user_uses integer := 0;
  v_discount numeric(12,2) := 0;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_items_total is null or p_items_total < 0 then raise exception 'PROMO_INVALID_TOTAL'; end if;
  if v_code = '' then raise exception 'PROMO_REQUIRED'; end if;

  select * into v_promo
  from public.promo_codes
  where upper(btrim(code)) = v_code;

  if not found then raise exception 'PROMO_NOT_FOUND'; end if;
  if not v_promo.is_active then raise exception 'PROMO_INACTIVE'; end if;
  if v_promo.starts_at is not null and now() < v_promo.starts_at then raise exception 'PROMO_NOT_STARTED'; end if;
  if v_promo.ends_at is not null and now() >= v_promo.ends_at then raise exception 'PROMO_EXPIRED'; end if;
  if p_items_total < v_promo.min_order_usd then raise exception 'PROMO_MIN_ORDER'; end if;
  if v_promo.usage_limit is not null and v_promo.times_redeemed >= v_promo.usage_limit then raise exception 'PROMO_USAGE_LIMIT'; end if;

  select count(*)::integer into v_user_uses
  from public.promo_redemptions
  where promo_code_id = v_promo.id and user_id = v_user;

  if v_user_uses >= v_promo.per_user_limit then raise exception 'PROMO_USER_LIMIT'; end if;

  if v_promo.discount_type = 'percent' then
    v_discount := round(p_items_total * v_promo.discount_value / 100.0, 2);
    if v_promo.max_discount_usd is not null then
      v_discount := least(v_discount, v_promo.max_discount_usd);
    end if;
  else
    v_discount := least(v_promo.discount_value, p_items_total);
  end if;

  v_discount := greatest(0, least(v_discount, p_items_total));

  return jsonb_build_object(
    'valid', true,
    'code', v_code,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value,
    'discount_total', v_discount,
    'items_total', p_items_total,
    'final_total', greatest(p_items_total - v_discount, 0),
    'min_order_usd', v_promo.min_order_usd,
    'max_discount_usd', v_promo.max_discount_usd
  );
end;
$function$;

CREATE OR REPLACE FUNCTION app_private.refresh_product_order_stats(p_product_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qty bigint := 0;
  v_last timestamptz;
begin
  if p_product_id is null then
    return;
  end if;

  select
    coalesce(sum(oi.quantity), 0)::bigint,
    max(o.created_at)
  into v_qty, v_last
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.product_id = p_product_id
    and o.status not in ('cancelled', 'failed', 'refused');

  insert into public.product_rank_stats(product_id, order_quantity, last_ordered_at, updated_at)
  values(p_product_id, v_qty, v_last, now())
  on conflict (product_id) do update
    set order_quantity = excluded.order_quantity,
        last_ordered_at = excluded.last_ordered_at,
        updated_at = now();
end;
$function$;

CREATE OR REPLACE FUNCTION public.checkout_buy_now_v2(p_product_id uuid, p_product_variant_id uuid, p_quantity integer, p_address_id uuid, p_customer_note text DEFAULT NULL::text, p_payment_method text DEFAULT 'cod'::text, p_delivery_method text DEFAULT 'standard'::text, p_promo_code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select app_private.checkout_buy_now_v2_impl(
    p_product_id, p_product_variant_id, p_quantity, p_address_id,
    p_customer_note, p_payment_method, p_delivery_method, p_promo_code
  );
$function$;

CREATE OR REPLACE FUNCTION public.checkout_cart_v2(p_address_id uuid, p_customer_note text DEFAULT NULL::text, p_delivery_method text DEFAULT 'standard'::text, p_payment_method text DEFAULT 'cod'::text, p_promo_code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select app_private.checkout_cart_v2_impl(
    p_address_id, p_customer_note, p_delivery_method, p_payment_method, p_promo_code
  );
$function$;

CREATE OR REPLACE FUNCTION public.erp_list_promo_codes()
 RETURNS TABLE(id uuid, code text, discount_type text, discount_value numeric, max_discount_usd numeric, min_order_usd numeric, starts_at timestamp with time zone, ends_at timestamp with time zone, usage_limit integer, per_user_limit integer, times_redeemed integer, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select * from app_private.erp_list_promo_codes_impl();
$function$;

CREATE OR REPLACE FUNCTION public.erp_set_promo_code_active(p_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select app_private.erp_set_promo_code_active_impl(p_id, p_active);
$function$;

CREATE OR REPLACE FUNCTION public.erp_upsert_promo_code(p_id uuid, p_code text, p_discount_type text, p_discount_value numeric, p_max_discount_usd numeric, p_min_order_usd numeric, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_usage_limit integer, p_per_user_limit integer, p_is_active boolean)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select app_private.erp_upsert_promo_code_impl(
    p_id, p_code, p_discount_type, p_discount_value, p_max_discount_usd,
    p_min_order_usd, p_starts_at, p_ends_at, p_usage_limit,
    p_per_user_limit, p_is_active
  );
$function$;

CREATE OR REPLACE FUNCTION public.market_catalog_products(p_query text DEFAULT NULL::text, p_category uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 120, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, store_id uuid, category_id uuid, name text, slug text, description text, price numeric, old_price numeric, currency text, stock_qty integer, has_variants boolean, is_active boolean, is_demo boolean, created_at timestamp with time zone, updated_at timestamp with time zone, rating_avg numeric, rating_count integer, store jsonb, image text, category_name text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    p.id,
    p.store_id,
    p.category_id,
    p.name,
    p.slug,
    p.description,
    p.price,
    p.old_price,
    p.currency,
    p.stock_qty,
    p.has_variants,
    p.is_active,
    p.is_demo,
    p.created_at,
    p.updated_at,
    p.rating_avg,
    p.rating_count,
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'slug', s.slug,
      'country_code', s.country_code,
      'status', s.status,
      'is_verified', s.is_verified,
      'is_partner', s.is_partner
    ) as store,
    img.secure_url as image,
    c.name as category_name
  from public.products p
  join public.stores s on s.id = p.store_id
  left join public.categories c on c.id = p.category_id
  left join public.product_rank_stats rs on rs.product_id = p.id
  left join lateral (
    select pi.secure_url
    from public.product_images pi
    where pi.product_id = p.id
    order by pi.sort_order, pi.created_at
    limit 1
  ) img on true
  where p.is_active = true
    and p.is_demo = false
    and s.is_demo = false
    and s.status = 'active'
    and s.country_code = 'CD'
    and (p_category is null or p.category_id = p_category)
    and (
      nullif(btrim(coalesce(p_query,'')), '') is null
      or p.name ilike '%' || btrim(p_query) || '%'
      or coalesce(p.description,'') ilike '%' || btrim(p_query) || '%'
      or s.name ilike '%' || btrim(p_query) || '%'
      or coalesce(c.name,'') ilike '%' || btrim(p_query) || '%'
    )
  order by (
      5.0 * ln(1.0 + coalesce(rs.order_quantity, 0)::numeric)
    + 3.0 * ln(1.0 + coalesce(rs.search_hits, 0)::numeric)
    + 2.0 * (coalesce(p.rating_avg, 0) / 5.0) * ln(2.0 + coalesce(p.rating_count, 0)::numeric)
    + 0.20 * greatest(
        0::numeric,
        1::numeric - (extract(epoch from (now() - p.created_at)) / 2592000.0)::numeric
      )
  ) desc,
  p.rating_avg desc,
  p.rating_count desc,
  p.created_at desc
  limit least(greatest(coalesce(p_limit,120),1),200)
  offset greatest(coalesce(p_offset,0),0);
$function$;

CREATE OR REPLACE FUNCTION public.promo_quote(p_code text, p_items_total numeric)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select app_private.promo_quote_impl(p_code, p_items_total);
$function$;

revoke all on function app_private.bump_product_search_stats() from public,anon,authenticated;
revoke all on function app_private.refresh_product_order_stats(uuid) from public,anon,authenticated;
revoke all on function app_private.order_item_refresh_product_rank() from public,anon,authenticated;
revoke all on function app_private.order_status_refresh_product_rank() from public,anon,authenticated;
revoke all on function app_private.apply_promo_to_order(uuid,text) from public,anon,authenticated;
revoke all on function app_private.promo_quote_impl(text,numeric) from public,anon;
grant execute on function app_private.promo_quote_impl(text,numeric) to authenticated;
grant execute on function app_private.checkout_cart_v2_impl(uuid,text,text,text,text) to authenticated;
grant execute on function app_private.checkout_buy_now_v2_impl(uuid,uuid,integer,uuid,text,text,text,text) to authenticated;
grant execute on function app_private.erp_list_promo_codes_impl() to authenticated;
grant execute on function app_private.erp_upsert_promo_code_impl(uuid,text,text,numeric,numeric,numeric,timestamptz,timestamptz,integer,integer,boolean) to authenticated;
grant execute on function app_private.erp_set_promo_code_active_impl(uuid,boolean) to authenticated;

revoke all on function public.promo_quote(text,numeric) from public,anon;
grant execute on function public.promo_quote(text,numeric) to authenticated;
revoke all on function public.checkout_cart_v2(uuid,text,text,text,text) from public,anon;
grant execute on function public.checkout_cart_v2(uuid,text,text,text,text) to authenticated;
revoke all on function public.checkout_buy_now_v2(uuid,uuid,integer,uuid,text,text,text,text) from public,anon;
grant execute on function public.checkout_buy_now_v2(uuid,uuid,integer,uuid,text,text,text,text) to authenticated;
revoke all on function public.erp_list_promo_codes() from public,anon;
grant execute on function public.erp_list_promo_codes() to authenticated;
revoke all on function public.erp_upsert_promo_code(uuid,text,text,numeric,numeric,numeric,timestamptz,timestamptz,integer,integer,boolean) from public,anon;
grant execute on function public.erp_upsert_promo_code(uuid,text,text,numeric,numeric,numeric,timestamptz,timestamptz,integer,integer,boolean) to authenticated;
revoke all on function public.erp_set_promo_code_active(uuid,boolean) from public,anon;
grant execute on function public.erp_set_promo_code_active(uuid,boolean) to authenticated;
grant execute on function public.market_catalog_products(text,uuid,integer,integer) to anon,authenticated;

drop trigger if exists product_search_events_rank_bump on public.product_search_events;
create trigger product_search_events_rank_bump after insert on public.product_search_events
for each row execute function app_private.bump_product_search_stats();

drop trigger if exists order_items_refresh_product_rank on public.order_items;
create trigger order_items_refresh_product_rank after insert or update of product_id,quantity or delete on public.order_items
for each row execute function app_private.order_item_refresh_product_rank();

drop trigger if exists orders_refresh_product_rank on public.orders;
create trigger orders_refresh_product_rank after update of status on public.orders
for each row execute function app_private.order_status_refresh_product_rank();

insert into public.product_rank_stats(product_id,order_quantity,last_ordered_at,updated_at)
select p.id,coalesce(x.qty,0)::bigint,x.last_ordered_at,now()
from public.products p
left join lateral (
  select coalesce(sum(oi.quantity),0) qty,max(o.created_at) last_ordered_at
  from public.order_items oi join public.orders o on o.id=oi.order_id
  where oi.product_id=p.id and o.status not in ('cancelled','failed','refused')
) x on true
on conflict(product_id) do update set
  order_quantity=excluded.order_quantity,
  last_ordered_at=excluded.last_ordered_at,
  updated_at=now();

create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);
grant select on public.conversations to authenticated;
grant select,insert on public.messages to authenticated;
grant select on public.seller_orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.stores to authenticated;
