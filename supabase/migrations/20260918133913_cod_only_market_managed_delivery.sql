update public.marketplace_settings
set value = coalesce(value, '{}'::jsonb)
  || jsonb_build_object(
    'cod_enabled', true,
    'mobile_money_enabled', false,
    'mobile_money_coming_soon', true
  ),
  updated_at = now()
where key = 'payments';

update public.delivery_methods
set fee_cdf = case code
  when 'standard' then 5000
  when 'express' then 15000
  else fee_cdf
end,
is_active = true,
updated_at = now()
where code in ('standard','express');

create or replace function app_private.prepare_seller_order_financials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_rate numeric;
begin
  -- V1: delivery is paid by the customer on the parent order and is fully managed by One Market.
  -- Sellers are never charged a delivery fee.
  new.delivery_fee := 0;
  new.delivery_fee_cdf := 0;

  v_rate := app_private.effective_store_commission(new.store_id);
  new.commission_percent := round(v_rate, 2);
  new.commission_amount := round(coalesce(new.subtotal,0) * v_rate / 100, 2);
  new.seller_net_amount := greatest(0, round(coalesce(new.subtotal,0) - new.commission_amount, 2));
  new.settlement_status := coalesce(new.settlement_status, 'unsettled');
  return new;
end;
$$;

comment on function app_private.prepare_seller_order_financials()
is 'Computes seller commission/net and enforces free seller delivery; customer delivery fees belong only to the parent order.';
