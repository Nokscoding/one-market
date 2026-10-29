
-- OneMarket closed beta: manual Orange Money / Airtel Money settlement.
-- Merchant API not required. Production activation requires the official receiving
-- numbers and a CDF/USD quote maintained by the Super Admin.
create table if not exists public.manual_mobile_money_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_id uuid not null,
  provider text not null check (provider in ('orange_money','airtel_money')),
  recipient_number text not null,
  exchange_rate_cdf_per_usd numeric(14,2) not null check (exchange_rate_cdf_per_usd > 0),
  expected_amount_cdf bigint not null check (expected_amount_cdf > 0),
  transaction_reference text,
  sender_phone text,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','submitted','verified','rejected')),
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid,
  verified_amount_cdf bigint,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists manual_mobile_money_unique_submitted_reference
  on public.manual_mobile_money_payments (provider, upper(transaction_reference))
  where transaction_reference is not null and status in ('submitted','verified');
create index if not exists manual_mobile_money_queue_idx
  on public.manual_mobile_money_payments (status, submitted_at desc);

alter table public.manual_mobile_money_payments enable row level security;
revoke all on public.manual_mobile_money_payments from public, anon;
grant select on public.manual_mobile_money_payments to authenticated;
drop policy if exists "manual_mobile_money_read_own_or_finance" on public.manual_mobile_money_payments;
create policy "manual_mobile_money_read_own_or_finance"
  on public.manual_mobile_money_payments for select to authenticated
  using (
    customer_id = (select auth.uid())
    or app_private.has_staff_permission('finance.manage')
    or app_private.staff_role() = 'SUPER_ADMIN'
  );

create or replace function public.manual_mobile_money_prepare(p_order_id uuid, p_provider text)
returns public.manual_mobile_money_payments language plpgsql security definer set search_path=''
as $$
declare
  v_order public.orders%rowtype;
  v_settings jsonb;
  v_number text;
  v_rate numeric;
  v_expected bigint;
  v_claim public.manual_mobile_money_payments%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_provider not in ('orange_money','airtel_money') then raise exception 'INVALID_PROVIDER'; end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.customer_id is distinct from auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.payment_method <> 'mobile_money' then raise exception 'NOT_MOBILE_MONEY'; end if;
  if v_order.payment_status in ('paid','cash_received','cancelled') or v_order.status in ('cancelled','failed','refused') then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;
  if v_order.currency <> 'USD' then raise exception 'UNSUPPORTED_ORDER_CURRENCY'; end if;

  select value into v_settings from public.marketplace_settings where key='payments';
  if coalesce(v_settings->>'mobile_money_backend_ready','false') <> 'true' or coalesce(v_settings->>'mobile_money_enabled','false') <> 'true'
      or coalesce(v_settings->>'mobile_money_coming_soon','true') = 'true' then
    raise exception 'PAYMENT_DISABLED';
  end if;
  v_number := nullif(btrim(v_settings->>(case when p_provider='orange_money' then 'orange_money_number' else 'airtel_money_number' end)),'');
  v_rate := coalesce(nullif(v_settings->>'mobile_money_rate_cdf_per_usd','')::numeric,0);
  if v_number is null or v_number !~ '^[+]?[0-9]{9,15}$' then raise exception 'PROVIDER_NOT_CONFIGURED'; end if;
  if v_rate <= 0 then raise exception 'PAYMENT_RATE_NOT_CONFIGURED'; end if;
  v_expected := round(coalesce(v_order.items_total,0) * v_rate + coalesce(v_order.delivery_fee_cdf,0))::bigint;
  if v_expected <= 0 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;

  select * into v_claim from public.manual_mobile_money_payments where order_id=p_order_id for update;
  if found then
    if v_claim.status in ('submitted','verified') then
      if v_claim.provider <> p_provider then raise exception 'PAYMENT_ALREADY_SUBMITTED'; end if;
      return v_claim;
    end if;
    if v_claim.status = 'rejected' then
      -- A rejected submission needs a new reference; keep its original invoice snapshot.
      if v_claim.provider <> p_provider then raise exception 'PAYMENT_PROVIDER_LOCKED'; end if;
      return v_claim;
    end if;
    update public.manual_mobile_money_payments
    set provider=p_provider,recipient_number=v_number,exchange_rate_cdf_per_usd=v_rate,
        expected_amount_cdf=v_expected,updated_at=now()
    where id=v_claim.id returning * into v_claim;
  else
    insert into public.manual_mobile_money_payments (
      order_id,customer_id,provider,recipient_number,exchange_rate_cdf_per_usd,expected_amount_cdf
    ) values (
      p_order_id,auth.uid(),p_provider,v_number,v_rate,v_expected
    ) returning * into v_claim;
  end if;
  return v_claim;
end
$$;

create or replace function public.manual_mobile_money_submit(
  p_order_id uuid,p_reference text,p_sender_phone text
) returns public.manual_mobile_money_payments
language plpgsql security definer set search_path=''
as $$
declare
  v_claim public.manual_mobile_money_payments%rowtype;
  v_reference text := upper(btrim(coalesce(p_reference,'')));
  v_phone text := regexp_replace(coalesce(p_sender_phone,''),'[^0-9+]','','g');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(v_reference)<6 or length(v_reference)>100 or v_reference !~ '^[A-Z0-9-]+$' then
    raise exception 'INVALID_REFERENCE';
  end if;
  if v_phone !~ '^[+]?[0-9]{9,15}$' then raise exception 'INVALID_SENDER_PHONE'; end if;

  select * into v_claim from public.manual_mobile_money_payments
  where order_id=p_order_id and customer_id=auth.uid() for update;
  if not found then raise exception 'PAYMENT_INVOICE_NOT_FOUND'; end if;
  if v_claim.status not in ('awaiting_payment','rejected') then raise exception 'PAYMENT_ALREADY_SUBMITTED'; end if;
  if not exists(select 1 from public.orders o where o.id=p_order_id and
    o.customer_id=auth.uid() and o.payment_status not in ('paid','cash_received','cancelled')
    and o.status not in ('cancelled','failed','refused')) then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;

  update public.manual_mobile_money_payments
  set transaction_reference=v_reference,sender_phone=v_phone,status='submitted',
      submitted_at=now(),review_note=null,verified_by=null,verified_at=null,
      verified_amount_cdf=null,updated_at=now()
  where id=v_claim.id returning * into v_claim;

  update public.orders set payment_status='payment_submitted',updated_at=now()
  where id=p_order_id and payment_status <> 'payment_submitted';

  return v_claim;
end
$$;

create or replace function public.manual_mobile_money_review(
  p_claim_id uuid, p_action text, p_seen_reference text,
  p_received_amount_cdf bigint, p_note text
) returns public.manual_mobile_money_payments
language plpgsql security definer set search_path=''
as $$
declare
  v_claim public.manual_mobile_money_payments%rowtype;
  v_order public.orders%rowtype;
begin
  if auth.uid() is null or not (
    app_private.has_staff_permission('finance.manage') or app_private.staff_role() = 'SUPER_ADMIN'
  ) then raise exception 'FINANCE_FORBIDDEN'; end if;
  if p_action not in ('confirm','reject') then raise exception 'INVALID_REVIEW_ACTION'; end if;
  select * into v_claim from public.manual_mobile_money_payments
  where id=p_claim_id for update;
  if not found or v_claim.status <> 'submitted' then raise exception 'PAYMENT_NOT_PENDING'; end if;
  select * into v_order from public.orders where id=v_claim.order_id for update;
  if v_order.payment_method <> 'mobile_money' or v_order.payment_status <> 'payment_submitted' then
    raise exception 'ORDER_PAYMENT_STATE_CHANGED';
  end if;
  if length(btrim(coalesce(p_note,''))) < 5 then raise exception 'REVIEW_NOTE_REQUIRED'; end if;

  if p_action='confirm' then
    if upper(btrim(coalesce(p_seen_reference,''))) <> v_claim.transaction_reference then
      raise exception 'TRANSACTION_REFERENCE_MISMATCH';
    end if;
    if p_received_amount_cdf is distinct from v_claim.expected_amount_cdf then
      raise exception 'AMOUNT_MISMATCH';
    end if;
    update public.manual_mobile_money_payments
    set status='verified',verified_by=auth.uid(),verified_at=now(),
        verified_amount_cdf=p_received_amount_cdf,review_note=btrim(p_note),updated_at=now()
    where id=v_claim.id returning * into v_claim;
    -- Preserve existing OneMarket order/payment lifecycle and audit hooks.
    perform public.erp_set_payment_status(v_claim.order_id,'paid');
  else
    update public.manual_mobile_money_payments
    set status='rejected',verified_by=auth.uid(),verified_at=now(),
        verified_amount_cdf=null,review_note=btrim(p_note),updated_at=now()
    where id=v_claim.id returning * into v_claim;
    update public.orders set payment_status='awaiting_mobile_money',updated_at=now()
    where id=v_claim.order_id;
  end if;
  return v_claim;
end
$$;

-- An older ERP screen or direct RPC must not mark an unverified Mobile Money
-- order as paid, nor release it for fulfillment while the payment is pending.
create or replace function app_private.guard_manual_mobile_money_settlement()
returns trigger language plpgsql set search_path=''
as $$
begin
  if new.payment_method='mobile_money' then
    if new.payment_status='paid' and old.payment_status is distinct from 'paid'
      and not exists (
        select 1 from public.manual_mobile_money_payments m
        where m.order_id=new.id and m.status='verified'
          and m.verified_amount_cdf=m.expected_amount_cdf
      ) then raise exception 'MANUAL_PAYMENT_REQUIRES_VERIFICATION'; end if;
    if new.status in ('confirmed','preparing','ready','picked_up','out_for_delivery','delivered')
      and old.status is distinct from new.status
      and new.payment_status <> 'paid'
      then raise exception 'UNPAID_MOBILE_ORDER_CANNOT_PROGRESS'; end if;
  end if;
  return new;
end
$$;
drop trigger if exists orders_guard_manual_mobile_money on public.orders;
create trigger orders_guard_manual_mobile_money
before update on public.orders for each row
execute function app_private.guard_manual_mobile_money_settlement();

revoke execute on function public.manual_mobile_money_prepare(uuid,text) from public, anon;
revoke execute on function public.manual_mobile_money_submit(uuid,text,text) from public, anon;
revoke execute on function public.manual_mobile_money_review(uuid,text,text,bigint,text) from public, anon;
grant execute on function public.manual_mobile_money_prepare(uuid,text) to authenticated;
grant execute on function public.manual_mobile_money_submit(uuid,text,text) to authenticated;
grant execute on function public.manual_mobile_money_review(uuid,text,text,bigint,text) to authenticated;

-- Configure the feature but do not allow payment collection until official
-- operator numbers and conversion rate have been supplied in the ERP.
update public.marketplace_settings
set value=coalesce(value,'{}'::jsonb) ||
  '{"mobile_money_enabled":true,"mobile_money_coming_soon":false,
    "orange_money_number":"","airtel_money_number":"",
    "mobile_money_rate_cdf_per_usd":0,"mobile_money_backend_ready":true}'::jsonb,
  updated_at=now()
where key='payments' and not (
  coalesce(value->>'orange_money_number','') <> ''
  or coalesce(value->>'airtel_money_number','') <> ''
);
