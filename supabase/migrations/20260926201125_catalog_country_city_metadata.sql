
create or replace function public.market_catalog_products(
  p_query text default null,
  p_category uuid default null,
  p_limit integer default 120,
  p_offset integer default 0
)
returns table(
  id uuid, store_id uuid, category_id uuid, name text, slug text, description text,
  price numeric, old_price numeric, currency text, stock_qty integer, has_variants boolean,
  is_active boolean, is_demo boolean, created_at timestamptz, updated_at timestamptz,
  rating_avg numeric, rating_count integer, store jsonb, image text, category_name text
)
language sql
stable
set search_path=''
as $function$
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
      'city', s.city,
      'status', s.status,
      'is_verified', s.is_verified,
      'is_partner', s.is_partner
    ) as store,
    img.secure_url as image,
    c.name as category_name
  from public.products p
  join public.stores s on s.id=p.store_id
  left join public.categories c on c.id=p.category_id
  left join public.product_rank_stats rs on rs.product_id=p.id
  left join lateral (
    select pi.secure_url
    from public.product_images pi
    where pi.product_id=p.id
    order by pi.sort_order,pi.created_at
    limit 1
  ) img on true
  where p.is_active=true
    and s.status='active'
    and s.country_code in ('CD','US')
    and p.name not ilike 'QA TEST%'
    and s.name not ilike 'QA TEST%'
    and (p_category is null or p.category_id=p_category)
    and (
      nullif(btrim(coalesce(p_query,'')),'') is null
      or p.name ilike '%'||btrim(p_query)||'%'
      or coalesce(p.description,'') ilike '%'||btrim(p_query)||'%'
      or s.name ilike '%'||btrim(p_query)||'%'
      or coalesce(c.name,'') ilike '%'||btrim(p_query)||'%'
    )
  order by (
      5.0*ln(1.0+coalesce(rs.order_quantity,0)::numeric)
    + 3.0*ln(1.0+coalesce(rs.search_hits,0)::numeric)
    + 2.0*(coalesce(p.rating_avg,0)/5.0)*ln(2.0+coalesce(p.rating_count,0)::numeric)
    + 0.20*greatest(0::numeric,1::numeric-(extract(epoch from (now()-p.created_at))/2592000.0)::numeric)
  ) desc,
  p.rating_avg desc,
  p.rating_count desc,
  p.created_at desc
  limit least(greatest(coalesce(p_limit,120),1),200)
  offset greatest(coalesce(p_offset,0),0);
$function$;
