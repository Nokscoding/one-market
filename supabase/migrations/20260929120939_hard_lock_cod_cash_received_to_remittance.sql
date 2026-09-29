
create or replace function public.erp_set_payment_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql
security definer
set search_path=''
as $function$
declare
  v public.orders%rowtype;
  b jsonb;
  v_title text;
  v_body text;
begin
  if not app_private.has_staff_permission('finance.manage')
     and app_private.staff_role()<>'SUPER_ADMIN' then
    raise exception 'ERP_FORBIDDEN';
  end if;

  if p_status not in ('pending_on_delivery','awaiting_mobile_money','payment_submitted','paid','cancelled') then
    if p_status='cash_received' then raise exception 'COD_REMITTANCE_REQUIRED'; end if;
    raise exception 'INVALID_PAYMENT_STATUS';
  end if;

  select * into v from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  b:=to_jsonb(v);
  if p_status=v.payment_status then return v; end if;
  if v.payment_status in ('paid','cash_received','cancelled') then raise exception 'PAYMENT_STATUS_FINAL'; end if;

  if v.payment_method='cod' then
    if p_status not in ('pending_on_delivery','cancelled') then raise exception 'INVALID_PAYMENT_TRANSITION'; end if;
  elsif v.payment_method='mobile_money' then
    if p_status not in ('awaiting_mobile_money','payment_submitted','paid','cancelled') then raise exception 'INVALID_PAYMENT_TRANSITION'; end if;
    if v.payment_status='payment_submitted' and p_status='awaiting_mobile_money' then raise exception 'INVALID_PAYMENT_TRANSITION'; end if;
  else
    raise exception 'INVALID_PAYMENT_TRANSITION';
  end if;

  if p_status='cancelled' then
    if exists(
      select 1 from public.seller_orders
      where order_id=p_order_id and status in ('picked_up','out_for_delivery','delivered')
    ) then raise exception 'PAYMENT_CANCELLATION_TOO_LATE'; end if;

    update public.seller_orders
    set status='cancelled',logistics_status='cancelled',updated_at=now()
    where order_id=p_order_id and status in ('pending','confirmed','preparing','ready');

    update public.orders
    set payment_status='cancelled',status='cancelled',logistics_status='cancelled',updated_at=now()
    where id=p_order_id returning * into v;

    insert into public.order_status_events(order_id,status,label)
    values(p_order_id,'cancelled','Commande annulée avant livraison');

    v_title:='Commande annulée';
    v_body:='Le paiement de votre commande '||v.order_number||' a été annulé. La commande ne sera pas préparée.';
  else
    update public.orders set payment_status=p_status,updated_at=now()
    where id=p_order_id returning * into v;

    if p_status='paid' then
      v_title:='Paiement confirmé';
      v_body:='Le paiement de votre commande '||v.order_number||' a été confirmé.';
    elsif p_status='payment_submitted' then
      v_title:='Paiement en vérification';
      v_body:='Le paiement de votre commande '||v.order_number||' est en cours de vérification.';
    end if;
  end if;

  if v_title is not null then
    insert into public.notifications(user_id,title,body,type,link)
    values(v.customer_id,v_title,v_body,'order','/orders/'||v.id::text);
  end if;

  if p_status='paid' and v.payment_method='mobile_money' then
    insert into public.notifications(user_id,title,body,type,link)
    select distinct s.owner_id,
      'Paiement confirmé',
      'Le paiement de la commande '||v.order_number||' est confirmé. Vous pouvez commencer la préparation.',
      'seller_order','/seller?tab=orders'
    from public.seller_orders so
    join public.stores s on s.id=so.store_id
    where so.order_id=v.id and s.owner_id is not null;
  end if;

  perform app_private.write_audit('order.payment_status','order',p_order_id::text,b,to_jsonb(v));
  return v;
end;
$function$;

create or replace function public.erp_confirm_courier_remittance(p_assignment_id uuid)
returns public.delivery_assignments
language plpgsql
security definer
set search_path=''
as $function$
declare
  v public.delivery_assignments%rowtype;
  v_order public.orders%rowtype;
  b_order jsonb;
begin
  if not app_private.has_staff_permission('finance.manage')
     and app_private.staff_role()<>'SUPER_ADMIN' then
    raise exception 'ERP_FORBIDDEN';
  end if;

  select * into v
  from public.delivery_assignments
  where id=p_assignment_id
  for update;
  if not found then raise exception 'DELIVERY_NOT_FOUND'; end if;
  if v.status<>'delivered' or v.collection_status<>'collected' then raise exception 'REMITTANCE_NOT_READY'; end if;

  select * into v_order from public.orders where id=v.order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.payment_method<>'cod' then raise exception 'NOT_COD_ORDER'; end if;
  if v_order.status not in ('delivered','partially_completed') then raise exception 'DELIVERY_NOT_COMPLETED'; end if;
  if v_order.payment_status<>'pending_on_delivery' then raise exception 'PAYMENT_STATUS_NOT_READY'; end if;

  b_order:=to_jsonb(v_order);

  update public.delivery_assignments
  set collection_status='remitted',remitted_at=now(),updated_at=now()
  where id=v.id
  returning * into v;

  update public.orders
  set payment_status='cash_received',updated_at=now()
  where id=v.order_id
  returning * into v_order;

  insert into public.notifications(user_id,title,body,type,link,meta)
  values(
    v_order.customer_id,
    'Paiement reçu',
    'Le paiement à la livraison de votre commande '||v_order.order_number||' a été confirmé par One Market.',
    'order',
    '/orders/'||v_order.id::text,
    jsonb_build_object('order_id',v_order.id,'payment_status','cash_received')
  );

  perform app_private.write_audit('order.payment_status','order',v_order.id::text,b_order,to_jsonb(v_order),jsonb_build_object('source','courier_remittance','assignment_id',v.id));
  perform app_private.write_audit('delivery.remittance','delivery_assignment',v.id::text,null,to_jsonb(v));

  return v;
end;
$function$;
