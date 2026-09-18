-- One Market: client access and seller access are cumulative capabilities.
-- Keep profiles.role for backwards compatibility / staff roles, but seller access
-- must no longer replace the customer's ability to use the marketplace.

alter table public.profiles
  add column if not exists seller_enabled boolean not null default false;

comment on column public.profiles.seller_enabled is
  'Additive seller capability. A seller remains a normal customer; this flag must not replace client access.';

update public.profiles p
set seller_enabled = true,
    updated_at = now()
where p.seller_enabled is distinct from true
  and (
    p.role = 'seller'::public.app_role
    or exists (
      select 1 from public.seller_applications a
      where a.user_id = p.id
        and a.status = 'approved'
    )
    or exists (
      select 1 from public.stores s
      where s.owner_id = p.id
    )
  );

create or replace function app_private.is_active_seller(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user
      and p.account_status = 'active'::public.account_status
      and p.seller_enabled = true
      and p.seller_terms_accepted_at is not null
  );
$$;

revoke all on function app_private.is_active_seller(uuid) from public;
grant execute on function app_private.is_active_seller(uuid) to authenticated, service_role;

revoke update on table public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url) on table public.profiles to authenticated;

revoke update on table public.notifications from anon, authenticated;
grant update (is_read) on table public.notifications to authenticated;

create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
set search_path = 'public'
as $$
begin
  if auth.uid() is not null
     and auth.uid() = old.id
     and current_user in ('authenticated','anon') then
    new.id := old.id;
    new.role := old.role;
    new.account_status := old.account_status;
    new.seller_enabled := old.seller_enabled;
    new.created_at := old.created_at;
    new.terms_accepted_at := old.terms_accepted_at;
    new.privacy_accepted_at := old.privacy_accepted_at;
    new.legal_version := old.legal_version;
    new.seller_terms_accepted_at := old.seller_terms_accepted_at;
    new.seller_legal_version := old.seller_legal_version;
  end if;
  return new;
end;
$$;

create or replace function app_private.promote_approved_seller_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' then
    update public.profiles
       set seller_enabled = true,
           updated_at = now()
     where id = new.user_id;
  end if;
  return new;
end;
$$;

drop policy if exists stores_insert_seller on public.stores;
create policy stores_insert_seller
on public.stores
for insert
to authenticated
with check (
  (
    owner_id = (select auth.uid())
    and app_private.is_active_seller((select auth.uid()))
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin'::public.app_role, 'global_admin'::public.app_role)
      and p.account_status = 'active'::public.account_status
  )
);

create or replace function public.protect_store_system_fields()
returns trigger
language plpgsql
set search_path = 'public'
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' and new.owner_id = auth.uid() then
      if app_private.is_active_seller(auth.uid()) then
        new.status := 'active';
      else
        new.status := 'pending';
      end if;
      new.is_verified := false;
      new.is_partner := false;
      new.is_demo := false;
    elsif tg_op = 'UPDATE' and old.owner_id = auth.uid() then
      new.owner_id := old.owner_id;
      new.status := old.status;
      new.is_verified := old.is_verified;
      new.is_partner := old.is_partner;
      new.is_demo := old.is_demo;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.erp_review_seller_application(
  p_application_id uuid,
  p_action text,
  p_note text default null::text
)
returns public.seller_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.seller_applications%rowtype;
  v_before jsonb;
  v_perm text;
begin
  v_perm := case p_action
    when 'approve' then 'sellers.approve'
    when 'reject' then 'sellers.reject'
    when 'needs_information' then 'sellers.review'
    when 'under_review' then 'sellers.review'
    when 'suspend' then 'sellers.suspend'
    else 'sellers.review'
  end;

  if not app_private.has_staff_permission(v_perm) then
    raise exception 'ERP_FORBIDDEN';
  end if;

  select * into v_app
  from public.seller_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'SELLER_APPLICATION_NOT_FOUND';
  end if;

  v_before := to_jsonb(v_app);

  if p_action = 'approve' then
    update public.seller_applications
       set status = 'approved',
           admin_note = nullif(btrim(p_note),''),
           reviewed_at = now(),
           reviewed_by = (select auth.uid()),
           updated_at = now()
     where id = p_application_id
     returning * into v_app;

    update public.profiles
       set seller_enabled = true,
           updated_at = now()
     where id = v_app.user_id;

    insert into public.notifications(user_id,title,body,type,link)
    values(v_app.user_id,'Compte vendeur approuvé','Votre dossier vendeur a été approuvé. Vous pouvez maintenant accéder à votre boutique.','seller','/seller');

  elsif p_action = 'reject' then
    if nullif(btrim(p_note),'') is null then raise exception 'REASON_REQUIRED'; end if;

    update public.seller_applications
       set status='rejected',
           admin_note=btrim(p_note),
           reviewed_at=now(),
           reviewed_by=(select auth.uid()),
           updated_at=now()
     where id=p_application_id
     returning * into v_app;

    update public.profiles
       set seller_enabled = false,
           updated_at = now()
     where id = v_app.user_id
       and not exists (select 1 from public.stores s where s.owner_id=v_app.user_id);

    insert into public.notifications(user_id,title,body,type,link)
    values(v_app.user_id,'Demande vendeur refusée',btrim(p_note),'seller','/account?seller=apply');

  elsif p_action = 'needs_information' then
    if nullif(btrim(p_note),'') is null then raise exception 'REASON_REQUIRED'; end if;

    update public.seller_applications
       set status='needs_information',
           admin_note=btrim(p_note),
           reviewed_at=now(),
           reviewed_by=(select auth.uid()),
           updated_at=now()
     where id=p_application_id
     returning * into v_app;

    insert into public.notifications(user_id,title,body,type,link)
    values(v_app.user_id,'Informations vendeur requises',btrim(p_note),'seller','/account?seller=apply');

  elsif p_action = 'under_review' then
    update public.seller_applications
       set status='under_review',
           admin_note=nullif(btrim(p_note),''),
           reviewed_at=now(),
           reviewed_by=(select auth.uid()),
           updated_at=now()
     where id=p_application_id
     returning * into v_app;

  elsif p_action = 'suspend' then
    if nullif(btrim(p_note),'') is null then raise exception 'REASON_REQUIRED'; end if;

    update public.seller_applications
       set status='suspended',
           admin_note=btrim(p_note),
           reviewed_at=now(),
           reviewed_by=(select auth.uid()),
           updated_at=now()
     where id=p_application_id
     returning * into v_app;

    update public.profiles
       set seller_enabled = false,
           updated_at = now()
     where id=v_app.user_id;

    update public.stores
       set status='suspended',
           updated_at=now()
     where owner_id=v_app.user_id;

    insert into public.notifications(user_id,title,body,type,link)
    values(v_app.user_id,'Compte vendeur suspendu',btrim(p_note),'seller','/account');

  else
    raise exception 'INVALID_ACTION';
  end if;

  perform app_private.write_audit(
    'seller_application.'||p_action,
    'seller_application',
    p_application_id::text,
    v_before,
    to_jsonb(v_app),
    jsonb_build_object('note',p_note)
  );

  return v_app;
end;
$$;

create or replace function app_private.seller_order_action_impl(
  p_seller_order_id uuid,
  p_action text,
  p_reason text default null::text
)
returns public.seller_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.seller_orders%rowtype;
  v_next text;
  v_store_name text;
  v_customer_id uuid;
  v_label text;
  v_title text;
  v_payment_method text;
  v_payment_status text;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform 1
  from public.orders o
  join public.seller_orders so on so.order_id=o.id
  join public.stores st on st.id=so.store_id
  where so.id=p_seller_order_id
    and (
      (st.owner_id=v_user and app_private.is_active_seller(v_user))
      or app_private.has_staff_permission('orders.manage')
    )
  for update of o;

  select so.* into v_order
  from public.seller_orders so
  join public.stores s on s.id = so.store_id
  where so.id = p_seller_order_id
    and (
      (
        s.owner_id = v_user
        and s.status = 'active'
        and app_private.is_active_seller(v_user)
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = v_user
          and p.role in ('admin','global_admin')
      )
    )
  for update;

  if not found then
    raise exception 'SELLER_ORDER_NOT_FOUND';
  end if;

  select o.payment_method, o.payment_status
    into v_payment_method, v_payment_status
  from public.orders o
  where o.id = v_order.order_id;

  if p_action <> 'refuse' then
    if v_payment_status = 'cancelled' then raise exception 'PAYMENT_CANCELLED'; end if;
    if v_payment_method = 'mobile_money' and v_payment_status <> 'paid' then
      raise exception 'PAYMENT_NOT_CONFIRMED';
    end if;
  end if;

  case p_action
    when 'confirm' then
      if v_order.status <> 'pending' then raise exception 'INVALID_SELLER_ORDER_TRANSITION'; end if;
      v_next := 'confirmed'; v_label := 'Boutique a confirmé la commande'; v_title := 'Commande confirmée';
    when 'prepare' then
      if v_order.status <> 'confirmed' then raise exception 'INVALID_SELLER_ORDER_TRANSITION'; end if;
      v_next := 'preparing'; v_label := 'Boutique prépare la commande'; v_title := 'Commande en préparation';
    when 'ready' then
      if v_order.status <> 'preparing' then raise exception 'INVALID_SELLER_ORDER_TRANSITION'; end if;
      v_next := 'ready'; v_label := 'Commande prête chez la boutique'; v_title := 'Commande prête';
    when 'refuse' then
      if v_order.status not in ('pending','confirmed') then raise exception 'INVALID_SELLER_ORDER_TRANSITION'; end if;
      if nullif(btrim(p_reason),'') is null then raise exception 'REFUSAL_REASON_REQUIRED'; end if;
      v_next := 'refused'; v_label := 'Boutique n’a pas pu accepter la commande'; v_title := 'Commande refusée par une boutique';
    else
      raise exception 'INVALID_SELLER_ORDER_ACTION';
  end case;

  update public.seller_orders
     set status = v_next,
         refusal_reason = case when v_next='refused' then btrim(p_reason) else refusal_reason end,
         updated_at = now()
   where id = p_seller_order_id
   returning * into v_order;

  select s.name, o.customer_id
    into v_store_name, v_customer_id
  from public.stores s
  join public.orders o on o.id=v_order.order_id
  where s.id=v_order.store_id;

  v_label := replace(v_label, 'Boutique', coalesce(v_store_name,'La boutique'));

  insert into public.order_status_events(order_id,status,label)
  values(v_order.order_id,v_next,v_label);

  if v_customer_id is not null then
    insert into public.notifications(user_id,title,body,type,link)
    values(
      v_customer_id,
      v_title,
      case when v_next='refused'
        then v_label || '. Consultez le détail de la commande pour voir la raison.'
        else v_label || '.'
      end,
      'order',
      '/orders/'||v_order.order_id::text
    );
  end if;

  return v_order;
end;
$$;
