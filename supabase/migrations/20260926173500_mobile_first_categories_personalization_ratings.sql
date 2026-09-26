
-- Final V1 mobile-first categories, personalization and rating synchronization.

-- 1) Remove historical fashion aliases and preserve product references.
update public.products
set category_id='aad86c0e-515b-4f43-b6d2-092cc38248e9'::uuid
where category_id='a278c7f2-c1ac-4ad4-8ff0-669391bf07ef'::uuid;

update public.stores
set primary_category_id='aad86c0e-515b-4f43-b6d2-092cc38248e9'::uuid
where primary_category_id='a278c7f2-c1ac-4ad4-8ff0-669391bf07ef'::uuid;

update public.ad_campaigns
set category_id='aad86c0e-515b-4f43-b6d2-092cc38248e9'::uuid
where category_id='a278c7f2-c1ac-4ad4-8ff0-669391bf07ef'::uuid;

update public.categories
set parent_id='aad86c0e-515b-4f43-b6d2-092cc38248e9'::uuid
where parent_id='a278c7f2-c1ac-4ad4-8ff0-669391bf07ef'::uuid;

update public.products
set category_id='3c18bfa8-988e-44ed-a716-2c5325e36f43'::uuid
where category_id='69f1d1d4-fb35-47d1-bae7-886517336709'::uuid;

update public.stores
set primary_category_id='3c18bfa8-988e-44ed-a716-2c5325e36f43'::uuid
where primary_category_id='69f1d1d4-fb35-47d1-bae7-886517336709'::uuid;

update public.ad_campaigns
set category_id='3c18bfa8-988e-44ed-a716-2c5325e36f43'::uuid
where category_id='69f1d1d4-fb35-47d1-bae7-886517336709'::uuid;

update public.categories
set parent_id='3c18bfa8-988e-44ed-a716-2c5325e36f43'::uuid
where parent_id='69f1d1d4-fb35-47d1-bae7-886517336709'::uuid;

delete from public.categories
where id in (
  'a278c7f2-c1ac-4ad4-8ff0-669391bf07ef'::uuid,
  '69f1d1d4-fb35-47d1-bae7-886517336709'::uuid
);

-- 2) Final public category directory.
insert into public.categories(name,slug,description,image_url,parent_id,is_active,sort_order)
values
('Vêtements Homme','vetements-homme','Vêtements et tenues pour homme.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/vetements-homme.webp',null,true,1),
('Vêtements Femme','vetements-femme','Vêtements et tenues pour femme.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/vetements-femme.webp',null,true,2),
('Accessoires Homme','accessoires-homme','Sacs, montres, lunettes et accessoires pour homme.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/accessoires-homme.webp',null,true,3),
('Accessoires Femme','accessoires-femme','Sacs, bijoux, montres et accessoires pour femme.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/accessoires-femme.webp',null,true,4),
('Chaussures','chaussures','Chaussures et sneakers.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/chaussures.webp',null,true,5),
('Sacs & bagages','sacs-bagages','Sacs, valises et bagages.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/sacs-bagages.webp',null,true,6),
('Électronique & Tech','electronique-tech','Téléphones, audio, accessoires et appareils électroniques.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/electronique-tech.webp',null,true,7),
('Informatique & bureau','informatique-bureau','Ordinateurs, périphériques et équipement de bureau.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/informatique-bureau.webp',null,true,8),
('Beauté & soins','beaute-soins','Beauté, hygiène et soins.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/beaute-soins.webp',null,true,9),
('Maison & mobilier','maison-mobilier','Maison, décoration et mobilier.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/maison-mobilier.webp',null,true,10),
('Sport & fitness','sport-fitness','Sport, fitness et entraînement.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/sport-fitness.webp',null,true,11),
('Alimentation & boissons','alimentation-boissons','Alimentation, boissons et épicerie.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/alimentation-boissons.webp',null,true,12),
('Bébé & enfants','bebe-enfants','Articles pour bébé et enfants.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/bebe-enfants.webp',null,true,13),
('Auto & moto','auto-moto','Accessoires et équipements auto et moto.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/auto-moto.webp',null,true,14),
('Livres, jeux & culture','livres-jeux-culture','Livres, jeux, loisirs et culture.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/livres-jeux-culture.webp',null,true,15),
('Bricolage & jardin','bricolage-jardin','Outils, bricolage et jardinage.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/bricolage-jardin.webp',null,true,16),
('Animaux','animaux','Produits et accessoires pour animaux.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/animaux.webp',null,true,17),
('Cadeaux','cadeaux','Cadeaux et idées pour toutes les occasions.','https://res.cloudinary.com/nks-services/image/upload/one-market/categories/cadeaux.webp',null,true,18)
on conflict (slug) do update set
  name=excluded.name,
  description=excluded.description,
  image_url=excluded.image_url,
  is_active=true,
  sort_order=excluded.sort_order;

-- 3) Product view signal, protected by RLS.
create table if not exists public.product_view_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.product_view_events enable row level security;

drop policy if exists product_view_events_insert_own on public.product_view_events;
create policy product_view_events_insert_own
on public.product_view_events for insert to authenticated
with check (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.products p
    join public.stores s on s.id=p.store_id
    where p.id=product_view_events.product_id
      and p.is_active=true and s.status='active' and s.country_code='CD'
      and p.name not ilike 'QA TEST%' and s.name not ilike 'QA TEST%'
  )
);

drop policy if exists product_view_events_select_own on public.product_view_events;
create policy product_view_events_select_own
on public.product_view_events for select to authenticated
using (user_id=(select auth.uid()));

revoke all on table public.product_view_events from anon,authenticated;
grant select,insert on table public.product_view_events to authenticated;

create index if not exists product_view_events_user_created_idx
on public.product_view_events(user_id,created_at desc);
create index if not exists product_view_events_product_idx
on public.product_view_events(product_id);

drop policy if exists product_search_events_select_own on public.product_search_events;
create policy product_search_events_select_own
on public.product_search_events for select to authenticated
using (user_id=(select auth.uid()));

grant select on table public.product_search_events to authenticated;

drop policy if exists product_search_events_insert_public on public.product_search_events;
create policy product_search_events_insert_public
on public.product_search_events for insert to anon,authenticated
with check (
  ((((select auth.uid()) is null) and user_id is null) or user_id=(select auth.uid()))
  and exists (
    select 1 from public.products p
    join public.stores s on s.id=p.store_id
    where p.id=product_search_events.product_id
      and p.is_active=true and s.status='active' and s.country_code='CD'
      and p.name not ilike 'QA TEST%' and s.name not ilike 'QA TEST%'
  )
);

-- 4) Category affinity: purchase dominates, then favorite/cart/search/view.
create or replace function public.market_user_category_affinity(p_limit integer default 8)
returns table(category_id uuid,category_name text,affinity_score numeric)
language sql stable security invoker set search_path=''
as $$
  with signals as (
    select p.category_id,sum(oi.quantity)::numeric*12 score
    from public.orders o
    join public.order_items oi on oi.order_id=o.id
    join public.products p on p.id=oi.product_id
    where o.customer_id=(select auth.uid())
      and o.status not in ('cancelled','failed','refused')
      and p.category_id is not null
    group by p.category_id
    union all
    select p.category_id,count(*)::numeric*6
    from public.product_favorites f
    join public.products p on p.id=f.product_id
    where f.user_id=(select auth.uid()) and p.category_id is not null
    group by p.category_id
    union all
    select p.category_id,sum(ci.quantity)::numeric*4
    from public.carts c
    join public.cart_items ci on ci.cart_id=c.id
    join public.products p on p.id=ci.product_id
    where c.customer_id=(select auth.uid()) and p.category_id is not null
    group by p.category_id
    union all
    select p.category_id,count(*)::numeric*2
    from public.product_search_events e
    join public.products p on p.id=e.product_id
    where e.user_id=(select auth.uid())
      and e.created_at>=now()-interval '120 days'
      and p.category_id is not null
    group by p.category_id
    union all
    select p.category_id,count(*)::numeric
    from public.product_view_events e
    join public.products p on p.id=e.product_id
    where e.user_id=(select auth.uid())
      and e.created_at>=now()-interval '60 days'
      and p.category_id is not null
    group by p.category_id
  ), scored as (
    select category_id,sum(score)::numeric score
    from signals group by category_id
  )
  select c.id,c.name,s.score
  from scored s
  join public.categories c on c.id=s.category_id and c.is_active=true
  order by s.score desc,c.sort_order,c.name
  limit least(greatest(coalesce(p_limit,8),1),20);
$$;

revoke all on function public.market_user_category_affinity(integer) from public,anon;
grant execute on function public.market_user_category_affinity(integer) to authenticated;

create or replace function public.market_home_personalized_products(p_limit integer default 30)
returns table(
  id uuid,store_id uuid,category_id uuid,name text,slug text,description text,
  price numeric,old_price numeric,currency text,stock_qty integer,has_variants boolean,
  is_active boolean,is_demo boolean,created_at timestamptz,updated_at timestamptz,
  rating_avg numeric,rating_count integer,store jsonb,image text,category_name text,
  affinity_score numeric
)
language sql stable security invoker set search_path=''
as $$
  with affinity as (
    select * from public.market_user_category_affinity(20)
  ), catalog as (
    select m.*,row_number() over ()::numeric base_rank
    from public.market_catalog_products(null,null,200,0) m
  )
  select c.id,c.store_id,c.category_id,c.name,c.slug,c.description,c.price,c.old_price,c.currency,
    c.stock_qty,c.has_variants,c.is_active,c.is_demo,c.created_at,c.updated_at,c.rating_avg,
    c.rating_count,c.store,c.image,c.category_name,coalesce(a.affinity_score,0)::numeric
  from catalog c
  left join affinity a on a.category_id=c.category_id
  order by (ln(1+coalesce(a.affinity_score,0))*9-c.base_rank*0.12) desc,c.base_rank
  limit least(greatest(coalesce(p_limit,30),1),80);
$$;

revoke all on function public.market_home_personalized_products(integer) from public,anon;
grant execute on function public.market_home_personalized_products(integer) to authenticated;

-- 5) Review aggregate synchronization. Keep one trigger for each concern.
drop trigger if exists trg_review_updated_at on public.product_reviews;
drop trigger if exists trg_review_verified_purchase on public.product_reviews;
drop trigger if exists trg_sync_product_rating on public.product_reviews;

drop trigger if exists trg_product_reviews_verified_purchase on public.product_reviews;
create trigger trg_product_reviews_verified_purchase
before insert or update of product_id,user_id
on public.product_reviews
for each row execute function public.set_review_verified_purchase();

drop trigger if exists trg_product_reviews_updated_at on public.product_reviews;
create trigger trg_product_reviews_updated_at
before update on public.product_reviews
for each row execute function public.touch_product_review_updated_at();

drop trigger if exists trg_product_reviews_sync_rating on public.product_reviews;
create trigger trg_product_reviews_sync_rating
after insert or delete or update of product_id,rating,status
on public.product_reviews
for each row execute function public.sync_product_rating_from_review();

update public.products p
set rating_avg=coalesce((
      select round(avg(r.rating)::numeric,2)
      from public.product_reviews r
      where r.product_id=p.id and r.status='published'
    ),0),
    rating_count=(
      select count(*)::integer
      from public.product_reviews r
      where r.product_id=p.id and r.status='published'
    );
