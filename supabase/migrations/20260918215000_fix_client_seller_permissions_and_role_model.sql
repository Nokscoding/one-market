-- Fix client + seller dual-capability permissions.
-- A seller is still a client account. seller_enabled is the seller capability.

grant update (full_name, phone, avatar_url) on table public.profiles to authenticated;
grant update (is_read) on table public.notifications to authenticated;
grant select on table public.ad_campaigns to authenticated;

update public.profiles
set role = 'client'::public.app_role,
    updated_at = now()
where role = 'seller'::public.app_role;

alter table public.profiles
  drop constraint if exists profiles_no_legacy_seller_role;

alter table public.profiles
  add constraint profiles_no_legacy_seller_role
  check (role <> 'seller'::public.app_role);

comment on column public.profiles.seller_enabled is
'Independent seller capability. A seller remains a client marketplace account; this flag grants seller features after approval.';

comment on column public.profiles.role is
'Core marketplace/system role. Normal buyers and approved sellers use client; seller is a retired legacy enum value.';
