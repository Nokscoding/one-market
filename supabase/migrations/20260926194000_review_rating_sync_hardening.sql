-- Product review aggregates must update immediately after create/edit/delete.
-- This also removes duplicate historical triggers and backfills existing products.

create or replace function public.refresh_product_rating(p_product_id uuid)
returns void
language sql
security definer
set search_path=''
as $$
  update public.products p
  set
    rating_avg = coalesce((
      select round(avg(r.rating)::numeric, 2)
      from public.product_reviews r
      where r.product_id = p_product_id
        and r.status = 'published'
    ), 0),
    rating_count = (
      select count(*)::integer
      from public.product_reviews r
      where r.product_id = p_product_id
        and r.status = 'published'
    )
  where p.id = p_product_id;
$$;

create or replace function public.sync_product_rating_from_review()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_rating(old.product_id);
    return old;
  end if;

  perform public.refresh_product_rating(new.product_id);

  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform public.refresh_product_rating(old.product_id);
  end if;

  return new;
end;
$$;

create or replace function public.set_review_verified_purchase()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  new.verified_purchase := exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id=o.id
    where o.customer_id=new.user_id
      and o.status='delivered'
      and oi.product_id=new.product_id
  );
  return new;
end;
$$;

create or replace function public.touch_product_review_updated_at()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists product_reviews_sync_rating_trg on public.product_reviews;
drop trigger if exists product_reviews_touch_updated_at_trg on public.product_reviews;
drop trigger if exists product_reviews_verified_purchase_trg on public.product_reviews;
drop trigger if exists trg_review_updated_at on public.product_reviews;
drop trigger if exists trg_review_verified_purchase on public.product_reviews;
drop trigger if exists trg_sync_product_rating on public.product_reviews;
drop trigger if exists trg_product_reviews_sync_rating on public.product_reviews;
drop trigger if exists trg_product_reviews_updated_at on public.product_reviews;
drop trigger if exists trg_product_reviews_verified_purchase on public.product_reviews;

create trigger trg_product_reviews_verified_purchase
before insert or update of product_id,user_id
on public.product_reviews
for each row execute function public.set_review_verified_purchase();

create trigger trg_product_reviews_updated_at
before update on public.product_reviews
for each row execute function public.touch_product_review_updated_at();

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
