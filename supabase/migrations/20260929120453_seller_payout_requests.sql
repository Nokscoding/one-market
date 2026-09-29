
create table if not exists public.seller_payout_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  requested_amount numeric(14,2) not null check (requested_amount > 0),
  currency text not null default 'USD' check (currency='USD'),
  status text not null default 'requested' check (status in ('requested','approved','rejected','cancelled','fulfilled')),
  seller_note text,
  admin_note text,
  payout_id uuid references public.seller_payouts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists seller_payout_requests_store_created_idx
  on public.seller_payout_requests(store_id,created_at desc);
create index if not exists seller_payout_requests_seller_created_idx
  on public.seller_payout_requests(seller_user_id,created_at desc);
create index if not exists seller_payout_requests_status_idx
  on public.seller_payout_requests(status,created_at desc);

alter table public.seller_payout_requests enable row level security;

drop policy if exists seller_payout_requests_read_own_or_finance on public.seller_payout_requests;
create policy seller_payout_requests_read_own_or_finance
on public.seller_payout_requests
for select
to authenticated
using (
  seller_user_id=(select auth.uid())
  or app_private.has_staff_permission('finance.manage')
  or app_private.staff_role()='SUPER_ADMIN'
);

revoke insert,update,delete on public.seller_payout_requests from anon,authenticated;
grant select on public.seller_payout_requests to authenticated;

create or replace function app_private.seller_payout_eligible_total(p_store_id uuid)
returns numeric
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce(sum(so.seller_net_amount),0)
  from public.seller_orders so
  where so.store_id=p_store_id
    and so.settlement_status='unsettled'
    and app_private.seller_order_is_payout_eligible(so.id)
    and not exists(
      select 1
      from public.seller_payout_items pi
      join public.seller_payouts p on p.id=pi.payout_id
      where pi.seller_order_id=so.id
        and p.status in ('pending','approved','paid')
    );
$function$;

revoke all on function app_private.seller_payout_eligible_total(uuid) from public,anon,authenticated;

create or replace function public.seller_payout_balance(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_owner uuid;
  v_eligible numeric(14,2) := 0;
  v_requested numeric(14,2) := 0;
  v_available numeric(14,2) := 0;
begin
  select owner_id into v_owner from public.stores where id=p_store_id;
  if v_owner is null then raise exception 'STORE_NOT_FOUND'; end if;

  if v_owner<>(select auth.uid())
     and not app_private.has_staff_permission('finance.view')
     and app_private.staff_role()<>'SUPER_ADMIN' then
    raise exception 'STORE_FORBIDDEN';
  end if;

  v_eligible := round(app_private.seller_payout_eligible_total(p_store_id),2);

  select coalesce(sum(requested_amount),0)
    into v_requested
  from public.seller_payout_requests
  where store_id=p_store_id
    and status in ('requested','approved');

  v_available := greatest(0,round(v_eligible-v_requested,2));

  return jsonb_build_object(
    'eligible_unpaid',v_eligible,
    'pending_requests',v_requested,
    'available_to_request',v_available,
    'currency','USD'
  );
end;
$function$;

revoke all on function public.seller_payout_balance(uuid) from public,anon;
grant execute on function public.seller_payout_balance(uuid) to authenticated;

create or replace function public.seller_request_payout(
  p_store_id uuid,
  p_amount numeric default null,
  p_note text default null
)
returns public.seller_payout_requests
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_owner uuid;
  v_balance jsonb;
  v_available numeric(14,2);
  v_amount numeric(14,2);
  v public.seller_payout_requests%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;

  select owner_id into v_owner
  from public.stores
  where id=p_store_id and status='active';

  if v_owner is null then raise exception 'STORE_NOT_FOUND'; end if;
  if v_owner<>(select auth.uid()) then raise exception 'STORE_FORBIDDEN'; end if;
  if not app_private.is_active_seller((select auth.uid())) then raise exception 'SELLER_FORBIDDEN'; end if;

  v_balance := public.seller_payout_balance(p_store_id);
  v_available := coalesce((v_balance->>'available_to_request')::numeric,0);
  v_amount := round(coalesce(p_amount,v_available),2);

  if v_available<=0 then raise exception 'NO_AVAILABLE_PAYOUT_BALANCE'; end if;
  if v_amount<=0 or v_amount>v_available then raise exception 'PAYOUT_REQUEST_AMOUNT_INVALID'; end if;

  insert into public.seller_payout_requests(
    store_id,seller_user_id,requested_amount,currency,status,seller_note
  )
  values(
    p_store_id,(select auth.uid()),v_amount,'USD','requested',nullif(btrim(coalesce(p_note,'')),'')
  )
  returning * into v;

  insert into public.admin_notifications(user_id,title,body,type,link,meta)
  select
    s.user_id,
    'Demande de paiement vendeur',
    st.name||' demande un versement de '||to_char(v_amount,'FM999999990.00')||' USD.',
    'finance',
    '/finance',
    jsonb_build_object('payout_request_id',v.id,'store_id',p_store_id,'amount',v_amount)
  from public.admin_staff s
  join public.stores st on st.id=p_store_id
  where s.status='active'
    and (
      s.staff_role='SUPER_ADMIN'
      or exists(
        select 1 from public.staff_role_permissions rp
        where rp.staff_role=s.staff_role and rp.permission='finance.manage'
      )
    );

  return v;
end;
$function$;

revoke all on function public.seller_request_payout(uuid,numeric,text) from public,anon;
grant execute on function public.seller_request_payout(uuid,numeric,text) to authenticated;

create or replace function public.seller_cancel_payout_request(p_request_id uuid)
returns public.seller_payout_requests
language plpgsql
security definer
set search_path=''
as $function$
declare
  v public.seller_payout_requests%rowtype;
begin
  select * into v
  from public.seller_payout_requests
  where id=p_request_id and seller_user_id=(select auth.uid())
  for update;

  if not found then raise exception 'PAYOUT_REQUEST_NOT_FOUND'; end if;
  if v.status<>'requested' then raise exception 'PAYOUT_REQUEST_NOT_CANCELLABLE'; end if;

  update public.seller_payout_requests
  set status='cancelled',updated_at=now()
  where id=p_request_id
  returning * into v;

  return v;
end;
$function$;

revoke all on function public.seller_cancel_payout_request(uuid) from public,anon;
grant execute on function public.seller_cancel_payout_request(uuid) to authenticated;

create or replace function public.erp_set_seller_payout_request_status(
  p_request_id uuid,
  p_status text,
  p_admin_note text default null,
  p_payout_id uuid default null
)
returns public.seller_payout_requests
language plpgsql
security definer
set search_path=''
as $function$
declare
  v public.seller_payout_requests%rowtype;
  v_payout public.seller_payouts%rowtype;
begin
  if not app_private.has_staff_permission('finance.manage')
     and app_private.staff_role()<>'SUPER_ADMIN' then
    raise exception 'ERP_FORBIDDEN';
  end if;

  if p_status not in ('approved','rejected','fulfilled') then
    raise exception 'PAYOUT_REQUEST_STATUS_INVALID';
  end if;

  select * into v
  from public.seller_payout_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'PAYOUT_REQUEST_NOT_FOUND'; end if;
  if v.status in ('rejected','cancelled','fulfilled') then raise exception 'PAYOUT_REQUEST_FINAL'; end if;

  if p_status='fulfilled' then
    if p_payout_id is null then raise exception 'PAYOUT_REQUIRED'; end if;
    select * into v_payout
    from public.seller_payouts
    where id=p_payout_id and store_id=v.store_id;
    if not found or v_payout.status<>'paid' then raise exception 'PAID_PAYOUT_REQUIRED'; end if;
  end if;

  update public.seller_payout_requests
  set
    status=p_status,
    admin_note=coalesce(nullif(btrim(coalesce(p_admin_note,'')),''),admin_note),
    payout_id=case when p_status='fulfilled' then p_payout_id else payout_id end,
    reviewed_at=now(),
    reviewed_by=(select auth.uid()),
    updated_at=now()
  where id=p_request_id
  returning * into v;

  insert into public.notifications(user_id,title,body,type,link,meta)
  values(
    v.seller_user_id,
    case p_status
      when 'approved' then 'Demande de paiement approuvée'
      when 'rejected' then 'Demande de paiement refusée'
      else 'Paiement vendeur effectué'
    end,
    case p_status
      when 'approved' then 'One Market a approuvé votre demande de versement. Le règlement est en préparation.'
      when 'rejected' then 'Votre demande de versement a été refusée. Consultez votre espace Finances pour les détails.'
      else 'Votre demande de versement a été marquée comme réglée.'
    end,
    'finance',
    '/seller?tab=finances',
    jsonb_build_object('payout_request_id',v.id,'status',p_status,'payout_id',v.payout_id)
  );

  perform app_private.write_audit(
    'seller_payout_request.status','seller_payout_request',v.id::text,null,to_jsonb(v)
  );

  return v;
end;
$function$;

revoke all on function public.erp_set_seller_payout_request_status(uuid,text,text,uuid) from public,anon;
grant execute on function public.erp_set_seller_payout_request_status(uuid,text,text,uuid) to authenticated;
