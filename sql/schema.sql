-- =====================================================================
-- ENGAGE 6.0  |  Run this WHOLE file once in Supabase -> SQL Editor
-- =====================================================================
create extension if not exists citext;
 
-- ---------- TABLES ----------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext not null unique,
  full_name     text not null check (char_length(full_name) between 2 and 80),
  roll_no       text not null check (char_length(roll_no) between 2 and 30),
  college       text not null check (char_length(college) between 2 and 120),
  course        text not null check (char_length(course) between 2 and 80),
  year_of_study smallint not null check (year_of_study between 1 and 6),
  phone         text not null check (phone ~ '^[6-9][0-9]{9}$'),
  github_url    text,
  linkedin_url  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_phone_key unique (phone)
);
create unique index profiles_college_roll_key on public.profiles (lower(college), lower(roll_no));
 
create type public.team_status as enum ('forming', 'payment_pending', 'paid');
 
create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       citext not null check (char_length(name) between 3 and 30),
  leader_id  uuid not null references public.profiles(id),
  status     public.team_status not null default 'forming',
  created_at timestamptz not null default now(),
  paid_at    timestamptz,
  constraint teams_name_key unique (name)
);
 
create table public.team_members (
  team_id   uuid not null references public.teams(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id),
  unique (user_id)                      -- a person can be in only ONE team
);
 
create table public.team_invites (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  invitee_id   uuid not null references public.profiles(id) on delete cascade,
  invited_by   uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);
create unique index team_invites_one_pending on public.team_invites (team_id, invitee_id) where status = 'pending';
 
create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  team_id              uuid not null references public.teams(id),
  created_by           uuid not null references public.profiles(id),
  razorpay_order_id    text not null unique,
  razorpay_payment_id  text unique,
  amount_paise         integer not null check (amount_paise > 0),
  members_count        smallint not null,
  status               text not null default 'created'
                       check (status in ('created', 'paid', 'cancelled', 'review')),
  created_at           timestamptz not null default now(),
  paid_at              timestamptz
);
-- at most one open (unpaid) order per team
create unique index payments_one_open_order on public.payments (team_id) where status = 'created';
 
-- ---------- ROW LEVEL SECURITY (defence in depth) ----------
-- The browser never queries these tables directly; it talks to the Node API,
-- which uses the service-role key. RLS stays ON so the public anon key can read nothing by accident.
alter table public.profiles     enable row level security;
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.payments     enable row level security;
 
create or replace function public.is_team_member(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where team_id = p_team and user_id = auth.uid());
$$;
 
create policy profiles_read_own    on public.profiles     for select to authenticated using (id = auth.uid());
create policy teams_read_member    on public.teams        for select to authenticated using (public.is_team_member(id));
create policy members_read_team    on public.team_members for select to authenticated using (public.is_team_member(team_id));
create policy invites_read_related on public.team_invites for select to authenticated
  using (invitee_id = auth.uid() or public.is_team_member(team_id));
create policy payments_read_team   on public.payments     for select to authenticated using (public.is_team_member(team_id));
-- No insert/update/delete policies on purpose: all writes go through the server.
 
-- ---------- ATOMIC BUSINESS FUNCTIONS (called ONLY by the server) ----------
create or replace function public.create_team(p_user uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_team uuid;
begin
  if not exists (select 1 from profiles where id = p_user) then raise exception 'PROFILE_REQUIRED'; end if;
  if exists (select 1 from team_members where user_id = p_user) then raise exception 'ALREADY_IN_TEAM'; end if;
  begin
    insert into teams (name, leader_id) values (p_name, p_user) returning id into v_team;
  exception when unique_violation then
    raise exception 'NAME_TAKEN';
  end;
  insert into team_members (team_id, user_id, role) values (v_team, p_user, 'leader');
  update team_invites set status = 'cancelled', responded_at = now()
   where invitee_id = p_user and status = 'pending';
  return v_team;
end $$;
 
create or replace function public.send_invite(p_leader uuid, p_team uuid, p_invitee uuid, p_max int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_team teams%rowtype; v_count int; v_id uuid;
begin
  select * into v_team from teams where id = p_team for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  if v_team.leader_id <> p_leader then raise exception 'NOT_LEADER'; end if;
  if v_team.status <> 'forming' then raise exception 'TEAM_LOCKED'; end if;
  if p_invitee = p_leader then raise exception 'SELF_INVITE'; end if;
  if not exists (select 1 from profiles where id = p_invitee) then raise exception 'NOT_REGISTERED'; end if;
  if exists (select 1 from team_members where user_id = p_invitee) then raise exception 'INVITEE_IN_TEAM'; end if;
  select count(*) into v_count from team_members where team_id = p_team;
  if v_count >= p_max then raise exception 'TEAM_FULL'; end if;
  begin
    insert into team_invites (team_id, invitee_id, invited_by)
    values (p_team, p_invitee, p_leader) returning id into v_id;
  exception when unique_violation then
    raise exception 'ALREADY_INVITED';
  end;
  return v_id;
end $$;
 
create or replace function public.accept_invite(p_user uuid, p_invite uuid, p_max int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv team_invites%rowtype; v_team teams%rowtype; v_count int;
begin
  select * into v_inv from team_invites where id = p_invite for update;
  if not found or v_inv.invitee_id <> p_user then raise exception 'INVITE_NOT_FOUND'; end if;
  if v_inv.status <> 'pending' then raise exception 'INVITE_CLOSED'; end if;
  select * into v_team from teams where id = v_inv.team_id for update;
  if v_team.status <> 'forming' then raise exception 'TEAM_LOCKED'; end if;
  if exists (select 1 from team_members where user_id = p_user) then raise exception 'ALREADY_IN_TEAM'; end if;
  select count(*) into v_count from team_members where team_id = v_team.id;
  if v_count >= p_max then raise exception 'TEAM_FULL'; end if;
  insert into team_members (team_id, user_id, role) values (v_team.id, p_user, 'member');
  update team_invites set status = 'accepted', responded_at = now() where id = p_invite;
  update team_invites set status = 'cancelled', responded_at = now()
   where invitee_id = p_user and status = 'pending' and id <> p_invite;
  return v_team.id;
end $$;
 
create or replace function public.remove_member(p_actor uuid, p_team uuid, p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_team teams%rowtype;
begin
  select * into v_team from teams where id = p_team for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  if v_team.status <> 'forming' then raise exception 'TEAM_LOCKED'; end if;
  if p_target = v_team.leader_id then raise exception 'LEADER_CANNOT_LEAVE'; end if;
  if p_actor <> p_target and v_team.leader_id <> p_actor then raise exception 'NOT_LEADER'; end if;
  delete from team_members where team_id = p_team and user_id = p_target;
  if not found then raise exception 'NOT_A_MEMBER'; end if;
end $$;
 
create or replace function public.disband_team(p_leader uuid, p_team uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_team teams%rowtype;
begin
  select * into v_team from teams where id = p_team for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  if v_team.leader_id <> p_leader then raise exception 'NOT_LEADER'; end if;
  if v_team.status <> 'forming' then raise exception 'TEAM_LOCKED'; end if;
  delete from payments where team_id = p_team and status in ('created', 'cancelled');
  delete from teams where id = p_team;          -- cascades members + invites
end $$;
 
-- Step 1 of payment: freeze the roster so the amount cannot change under the payer.
create or replace function public.freeze_team(p_leader uuid, p_team uuid, p_min int)
returns int language plpgsql security definer set search_path = public as $$
declare v_team teams%rowtype; v_count int;
begin
  select * into v_team from teams where id = p_team for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  if v_team.leader_id <> p_leader then raise exception 'NOT_LEADER'; end if;
  if v_team.status = 'paid' then raise exception 'ALREADY_PAID'; end if;
  select count(*) into v_count from team_members where team_id = p_team;
  if v_count < p_min then raise exception 'TEAM_TOO_SMALL'; end if;
  update teams set status = 'payment_pending' where id = p_team;
  update team_invites set status = 'cancelled', responded_at = now()
   where team_id = p_team and status = 'pending';
  return v_count;
end $$;
 
-- Un-freeze (only call after confirming with Razorpay that the order is NOT paid).
create or replace function public.cancel_payment(p_team uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update payments set status = 'cancelled' where team_id = p_team and status = 'created';
  update teams set status = 'forming' where id = p_team and status = 'payment_pending';
end $$;
 
-- Idempotent: safe to call from /verify AND from the webhook, in any order, any number of times.
create or replace function public.mark_team_paid(p_order_id text, p_payment_id text, p_fee_paise int, p_min int)
returns text language plpgsql security definer set search_path = public as $$
declare v_pay payments%rowtype; v_team teams%rowtype; v_count int;
begin
  select * into v_pay from payments where razorpay_order_id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_pay.status = 'paid' then return 'already'; end if;
  select * into v_team from teams where id = v_pay.team_id for update;
  if v_team.status = 'paid' then
    update payments set status = 'review', razorpay_payment_id = p_payment_id where id = v_pay.id;
    return 'duplicate';                          -- team already paid via another order: refund manually
  end if;
  select count(*) into v_count from team_members where team_id = v_team.id;
  if v_count >= p_min and v_pay.amount_paise = v_count * p_fee_paise then
    update payments set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now() where id = v_pay.id;
    update teams set status = 'paid', paid_at = now() where id = v_team.id;
    update team_invites set status = 'cancelled', responded_at = now()
     where team_id = v_team.id and status = 'pending';
    return 'paid';
  end if;
  update payments set status = 'review', razorpay_payment_id = p_payment_id where id = v_pay.id;
  return 'review';                               -- amount no longer matches roster: organisers review/refund
end $$;
 
-- Lock the functions down: ONLY the server (service_role) may call them.
do $$
declare f text;
begin
  foreach f in array array[
    'create_team(uuid,text)', 'send_invite(uuid,uuid,uuid,int)', 'accept_invite(uuid,uuid,int)',
    'remove_member(uuid,uuid,uuid)', 'disband_team(uuid,uuid)', 'freeze_team(uuid,uuid,int)',
    'cancel_payment(uuid)', 'mark_team_paid(text,text,int,int)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
