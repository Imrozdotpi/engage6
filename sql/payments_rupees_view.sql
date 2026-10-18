-- OPTIONAL: shows payments in RUPEES in Supabase (view "payments_rupees"). The real table stays in paise on purpose
-- (Razorpay works in paise and the code depends on it). Safe to run once; does not touch the payments table.
do $$
begin
  begin
    execute 'create or replace view public.payments_rupees with (security_invoker = true) as
             select p.id, p.team_id, p.status, round(p.amount_paise / 100.0, 2) as amount_rupees, p.members_count,
                    p.razorpay_order_id, p.razorpay_payment_id, p.created_at, p.paid_at from public.payments p';
  exception when others then
    execute 'create or replace view public.payments_rupees as
             select p.id, p.team_id, p.status, round(p.amount_paise / 100.0, 2) as amount_rupees, p.members_count,
                    p.razorpay_order_id, p.razorpay_payment_id, p.created_at, p.paid_at from public.payments p';
  end;
end $$;
revoke all on public.payments_rupees from public, anon, authenticated;
grant select on public.payments_rupees to service_role;
