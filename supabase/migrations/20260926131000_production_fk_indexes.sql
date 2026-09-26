-- Production-only performance hardening.
-- Adds covering indexes for foreign keys reported by the Supabase performance advisor.

create index if not exists ad_campaigns_approved_by_idx on public.ad_campaigns(approved_by);
create index if not exists ad_campaigns_package_id_idx on public.ad_campaigns(package_id);
create index if not exists delivery_assignments_assigned_by_idx on public.delivery_assignments(assigned_by);
create index if not exists delivery_incidents_assignment_id_idx on public.delivery_incidents(assignment_id);
create index if not exists delivery_incidents_courier_user_id_idx on public.delivery_incidents(courier_user_id);
create index if not exists delivery_incidents_resolved_by_idx on public.delivery_incidents(resolved_by);
create index if not exists orders_promo_code_id_idx on public.orders(promo_code_id);
create index if not exists promo_codes_created_by_idx on public.promo_codes(created_by);
create index if not exists promo_redemptions_user_id_idx on public.promo_redemptions(user_id);
create index if not exists seller_order_pickup_codes_verified_assignment_id_idx on public.seller_order_pickup_codes(verified_assignment_id);
create index if not exists seller_order_pickup_codes_verified_by_idx on public.seller_order_pickup_codes(verified_by);
