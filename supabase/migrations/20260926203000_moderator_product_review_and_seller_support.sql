create or replace function app_private.prepare_support_ticket()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_role text;
  v_phone text;
begin
  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'SUPPORT_USER_MISMATCH';
  end if;

  select p.role::text, p.phone
  into v_role, v_phone
  from public.profiles p
  where p.id=(select auth.uid());

  if new.source='moderation' and app_private.has_staff_permission('products.moderate') then
    new.reporter_role := 'MODERATOR';
    new.reporter_phone := nullif(btrim(coalesce(new.reporter_phone,v_phone,'')),'');
    return new;
  end if;

  new.reporter_role := coalesce(v_role,'client');
  new.reporter_phone := nullif(btrim(coalesce(new.reporter_phone,v_phone,'')),'');
  if new.reporter_phone is null
     or char_length(new.reporter_phone) < 7
     or char_length(new.reporter_phone) > 30 then
    raise exception 'REPORTER_PHONE_REQUIRED';
  end if;

  return new;
end;
$function$;

drop policy if exists support_tickets_moderation_target_read on public.support_tickets;
create policy support_tickets_moderation_target_read
on public.support_tickets
for select
to authenticated
using (
  source='moderation'
  and target_user_id=(select auth.uid())
);

drop policy if exists support_ticket_messages_moderation_target_read on public.support_ticket_messages;
create policy support_ticket_messages_moderation_target_read
on public.support_ticket_messages
for select
to authenticated
using (
  not is_internal
  and exists (
    select 1
    from public.support_tickets t
    where t.id=support_ticket_messages.ticket_id
      and t.source='moderation'
      and t.target_user_id=(select auth.uid())
  )
);

drop policy if exists support_ticket_messages_moderation_target_insert on public.support_ticket_messages;
create policy support_ticket_messages_moderation_target_insert
on public.support_ticket_messages
for insert
to authenticated
with check (
  author_id=(select auth.uid())
  and is_internal=false
  and exists (
    select 1
    from public.support_tickets t
    where t.id=support_ticket_messages.ticket_id
      and t.source='moderation'
      and t.target_user_id=(select auth.uid())
      and t.status <> 'closed'
  )
);

create or replace function public.erp_send_product_moderation_notice(
  p_product_id uuid,
  p_issue_type text,
  p_message text,
  p_hide_product boolean default false
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_product public.products%rowtype;
  v_store public.stores%rowtype;
  v_ticket_id uuid;
  v_subject text;
  v_priority text := 'normal';
  v_message text := btrim(coalesce(p_message,''));
begin
  if not app_private.has_staff_permission('products.moderate') then
    raise exception 'ERP_FORBIDDEN';
  end if;

  if p_issue_type not in ('photo_quality','photo_inappropriate','listing_quality','other') then
    raise exception 'MODERATION_ISSUE_INVALID';
  end if;

  if char_length(v_message) < 10 or char_length(v_message) > 3000 then
    raise exception 'MESSAGE_LENGTH_INVALID';
  end if;

  select * into v_product
  from public.products
  where id=p_product_id;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select * into v_store
  from public.stores
  where id=v_product.store_id;

  if not found or v_store.owner_id is null then
    raise exception 'STORE_OWNER_NOT_FOUND';
  end if;

  v_subject := case p_issue_type
    when 'photo_quality' then 'Photo produit à améliorer · ' || v_product.name
    when 'photo_inappropriate' then 'Photo produit non conforme · ' || v_product.name
    when 'listing_quality' then 'Présentation produit à améliorer · ' || v_product.name
    else 'Message de modération · ' || v_product.name
  end;

  if p_issue_type='photo_inappropriate' then
    v_priority := 'high';
  end if;

  insert into public.support_tickets(
    user_id,category,subject,message,status,priority,source,target_type,
    target_user_id,store_id,product_id,assigned_to,assigned_department
  )
  values(
    (select auth.uid()),'product',left(v_subject,140),v_message,'open',v_priority,
    'moderation','product',v_store.owner_id,v_store.id,v_product.id,
    (select auth.uid()),'MODERATION'
  )
  returning id into v_ticket_id;

  insert into public.notifications(user_id,title,body,type,link,meta)
  values(
    v_store.owner_id,
    case
      when p_issue_type='photo_inappropriate' then 'Photo produit à corriger'
      when p_issue_type='photo_quality' then 'Qualité de photo à améliorer'
      when p_issue_type='listing_quality' then 'Présentation produit à améliorer'
      else 'Message de la modération One Market'
    end,
    left(v_message,240),
    'moderation',
    '/seller?tab=support&ticket=' || v_ticket_id::text,
    jsonb_build_object('ticket_id',v_ticket_id,'product_id',v_product.id,'store_id',v_store.id,'issue_type',p_issue_type)
  );

  if coalesce(p_hide_product,false) and v_product.is_active then
    perform public.erp_moderate_product(
      v_product.id,
      false,
      'Masqué pendant la correction demandée par la modération : ' || left(v_message,400)
    );
  end if;

  perform app_private.write_audit(
    'product.moderation_notice',
    'product',
    v_product.id::text,
    null,
    jsonb_build_object('ticket_id',v_ticket_id,'issue_type',p_issue_type,'seller_user_id',v_store.owner_id,'hidden',coalesce(p_hide_product,false)),
    jsonb_build_object('message',v_message)
  );

  return v_ticket_id;
end;
$function$;

revoke all on function public.erp_send_product_moderation_notice(uuid,text,text,boolean) from public,anon;
grant execute on function public.erp_send_product_moderation_notice(uuid,text,text,boolean) to authenticated;

create or replace function public.erp_reply_support_ticket(
  p_ticket_id uuid,
  p_message text,
  p_internal boolean default false
)
returns public.support_ticket_messages
language plpgsql
security definer
set search_path=''
as $function$
declare
  m public.support_ticket_messages%rowtype;
  t public.support_tickets%rowtype;
  v_recipient uuid;
  v_link text;
begin
  if not app_private.has_staff_permission('support.manage')
     and app_private.staff_role()<>'SUPER_ADMIN' then
    raise exception 'ERP_FORBIDDEN';
  end if;

  if nullif(btrim(p_message),'') is null then
    raise exception 'MESSAGE_REQUIRED';
  end if;

  select * into t
  from public.support_tickets
  where id=p_ticket_id;

  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  insert into public.support_ticket_messages(ticket_id,author_id,message,is_internal)
  values(p_ticket_id,(select auth.uid()),btrim(p_message),coalesce(p_internal,false))
  returning * into m;

  if not coalesce(p_internal,false) then
    v_recipient := case
      when t.source='moderation' and t.target_user_id is not null then t.target_user_id
      else t.user_id
    end;

    v_link := case
      when t.source in ('moderation','seller_workspace')
        then '/seller?tab=support&ticket=' || p_ticket_id::text
      else '/account?tab=support'
    end;

    insert into public.notifications(user_id,title,body,type,link,meta)
    values(
      v_recipient,
      case when t.source='moderation' then 'Réponse de la modération One Market' else 'Réponse du support One Market' end,
      left(btrim(p_message),240),
      case when t.source='moderation' then 'moderation' else 'support' end,
      v_link,
      jsonb_build_object('ticket_id',p_ticket_id)
    );
  end if;

  perform app_private.write_audit('support.reply','support_ticket',p_ticket_id::text,null,to_jsonb(m));
  return m;
end;
$function$;

create or replace function public.erp_support_tickets(
  p_status text default null,
  p_ticket_id uuid default null,
  p_limit integer default 250
)
returns setof jsonb
language plpgsql
security definer
set search_path=''
as $function$
begin
  if not app_private.has_staff_permission('support.view')
     and app_private.staff_role()<>'SUPER_ADMIN' then
    raise exception 'ERP_FORBIDDEN';
  end if;

  return query
    select to_jsonb(t) || jsonb_build_object(
      'reporter_name', p.full_name,
      'reporter_profile_phone', p.phone,
      'reporter_marketplace_role', p.role::text,
      'reporter_email', u.email,
      'target_name', tp.full_name,
      'target_phone', tp.phone,
      'target_marketplace_role', tp.role::text,
      'target_email', tu.email
    )
    from public.support_tickets t
    left join public.profiles p on p.id=t.user_id
    left join auth.users u on u.id=t.user_id
    left join public.profiles tp on tp.id=t.target_user_id
    left join auth.users tu on tu.id=t.target_user_id
    where (p_status is null or t.status=p_status)
      and (p_ticket_id is null or t.id=p_ticket_id)
    order by t.created_at desc
    limit greatest(1,least(coalesce(p_limit,250),500));
end;
$function$;

create or replace function app_private.notify_seller_support_activity()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  t public.support_tickets%rowtype;
begin
  if tg_table_name='support_tickets' then
    if new.source='seller_workspace' then
      insert into public.admin_notifications(user_id,title,body,type,link,meta)
      select s.user_id,'Nouveau ticket vendeur',left(new.subject,240),'support',
             '/support/' || new.id::text,
             jsonb_build_object('ticket_id',new.id,'store_id',new.store_id,'product_id',new.product_id)
      from public.admin_staff s
      where s.status='active'
        and (
          s.staff_role='SUPER_ADMIN'
          or s.staff_role='MODERATOR'
          or exists (
            select 1 from public.staff_role_permissions rp
            where rp.staff_role=s.staff_role and rp.permission='support.manage'
          )
        );
    end if;
    return new;
  end if;

  if new.is_internal then return new; end if;

  select * into t
  from public.support_tickets
  where id=new.ticket_id;

  if not found then return new; end if;

  if t.source='moderation' and t.target_user_id is not null and new.author_id=t.target_user_id then
    insert into public.admin_notifications(user_id,title,body,type,link,meta)
    values(
      t.user_id,'Réponse du vendeur',left(new.message,240),'support',
      '/support/' || t.id::text,
      jsonb_build_object('ticket_id',t.id,'store_id',t.store_id,'product_id',t.product_id)
    );
  elsif t.source='seller_workspace' and new.author_id=t.user_id then
    insert into public.admin_notifications(user_id,title,body,type,link,meta)
    select s.user_id,'Nouveau message vendeur',left(new.message,240),'support',
           '/support/' || t.id::text,
           jsonb_build_object('ticket_id',t.id,'store_id',t.store_id,'product_id',t.product_id)
    from public.admin_staff s
    where s.status='active'
      and (s.staff_role='SUPER_ADMIN' or s.staff_role='MODERATOR' or s.user_id=t.assigned_to);
  end if;

  return new;
end;
$function$;

drop trigger if exists support_ticket_seller_activity_notify on public.support_tickets;
create trigger support_ticket_seller_activity_notify
after insert on public.support_tickets
for each row execute function app_private.notify_seller_support_activity();

drop trigger if exists support_message_seller_activity_notify on public.support_ticket_messages;
create trigger support_message_seller_activity_notify
after insert on public.support_ticket_messages
for each row execute function app_private.notify_seller_support_activity();

revoke all on function app_private.notify_seller_support_activity() from public,anon,authenticated;
