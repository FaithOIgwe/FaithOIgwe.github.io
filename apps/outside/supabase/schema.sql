-- Outside: database setup for accounts, hosted plans, Who's down, circles and safety.
-- Run once in Supabase: SQL Editor › New query › paste all of this › Run.
-- Every table starts with out_ so it sits safely beside Cahier's tables in the same project.
-- Safe to run again: it drops and recreates only Outside's functions and policies, never your data.

-- ============ TABLES ============
create table if not exists public.out_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.out_settings (
  id int primary key default 1 check (id = 1),
  first_fee int not null default 500 check (first_fee >= 0),
  pay_info text check (char_length(pay_info) <= 300),
  pass_price int not null default 0 check (pass_price >= 0),
  pass_note text check (char_length(pass_note) <= 200)
);
insert into public.out_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.out_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  city text not null default 'Abuja' check (city in ('Abuja','Lagos')),
  age_band text check (age_band in ('18–24','25–34','35–44','45+')),
  is_woman boolean not null default false,
  wants text[] not null default '{}' check (cardinality(wants) <= 30),
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  invited_by uuid references public.out_profiles(id) on delete set null,
  ref_note text check (char_length(ref_note) <= 60),
  verified boolean not null default false,
  suspended boolean not null default false,
  strike_reset int not null default 0,
  pass_until date,
  created_at timestamptz not null default now()
);

-- Phone numbers and trusted contacts: only the person and the host can read these.
create table if not exists public.out_private (
  id uuid primary key references public.out_profiles(id) on delete cascade,
  phone text not null check (char_length(phone) between 5 and 20),
  tc_name text check (char_length(tc_name) <= 40),
  tc_phone text check (char_length(tc_phone) <= 20)
);

create table if not exists public.out_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  city text not null default 'Abuja' check (city in ('Abuja','Lagos')),
  kind text not null default 'eat',
  starts_at timestamptz not null,
  venue text check (char_length(venue) <= 80),
  area text check (char_length(area) <= 40),
  cap int not null default 6 check (cap between 2 and 50),
  fee int not null default 0 check (fee >= 0),
  budget text check (char_length(budget) <= 40),
  ages text check (char_length(ages) <= 30),
  women_only boolean not null default false,
  partner boolean not null default false,
  notes text check (char_length(notes) <= 200),
  created_at timestamptz not null default now()
);

create table if not exists public.out_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.out_events(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.out_profiles(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','confirmed','waitlist','cancelled')),
  amount int not null default 0,
  sent boolean not null default false,
  paid boolean not null default false,
  checked_in_at timestamptz,
  home_safe_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.out_feedback (
  rsvp_id uuid primary key references public.out_rsvps(id) on delete cascade,
  event_id uuid not null references public.out_events(id) on delete cascade,
  user_id uuid not null references public.out_profiles(id) on delete cascade,
  meet_again uuid[] not null default '{}',
  rating int check (rating between 1 and 5),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

create table if not exists public.out_asks (
  id uuid primary key default gen_random_uuid(),
  by_user uuid not null default auth.uid() references public.out_profiles(id) on delete cascade,
  city text not null default 'Abuja' check (city in ('Abuja','Lagos')),
  what text not null check (char_length(what) between 1 and 100),
  when_at timestamptz not null,
  place text not null check (char_length(place) between 1 and 100),
  budget text check (char_length(budget) <= 40),
  seats int not null default 3 check (seats between 1 and 10),
  ring text not null default 'met' check (ring in ('circles','met','everyone','invite')),
  invite uuid[] not null default '{}',
  joins uuid[] not null default '{}',
  status text not null default 'open' check (status in ('open','closed')),
  hap_id text,
  circle_id uuid,
  created_at timestamptz not null default now()
);

-- "Would you meet them again?" after a Who's down meetup.
create table if not exists public.out_ask_fb (
  ask_id uuid not null references public.out_asks(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.out_profiles(id) on delete cascade,
  meet_again uuid[] not null default '{}',
  rating int check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (ask_id, user_id)
);

create table if not exists public.out_circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  city text not null default 'Abuja' check (city in ('Abuja','Lagos')),
  members uuid[] not null check (cardinality(members) between 2 and 12),
  from_event uuid references public.out_events(id) on delete set null,
  history jsonb not null default '[]',
  next_plan jsonb,
  host_idx int not null default 0,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.out_happenings (
  id text primary key,
  title text not null check (char_length(title) between 1 and 100),
  city text not null check (city in ('Abuja','Lagos')),
  start_date date not null,
  end_date date,
  venue text,
  price text,
  link text check (link is null or link = '' or link like 'https://%'),
  note text
);

create table if not exists public.out_reports (
  id uuid primary key default gen_random_uuid(),
  by_user uuid not null default auth.uid() references public.out_profiles(id) on delete cascade,
  about uuid references public.out_profiles(id) on delete cascade,
  ask_id uuid references public.out_asks(id) on delete set null,
  why text not null check (char_length(why) between 1 and 500),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);

create table if not exists public.out_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.out_profiles(id) on delete cascade,
  body text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists out_rsvps_event on public.out_rsvps(event_id);
create index if not exists out_rsvps_user on public.out_rsvps(user_id);
create index if not exists out_asks_when on public.out_asks(when_at);
create index if not exists out_notes_user on public.out_notes(user_id, created_at desc);

-- ============ HELPERS ============
create or replace function public.out_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from out_admins where user_id = auth.uid())
$$;

create or replace function public.out_me_ok(need_verified boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from out_profiles where id = auth.uid() and not suspended and (verified or not need_verified))
$$;

create or replace function public.out_circle_mates(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from out_circles where a = any(members) and b = any(members))
$$;

-- Two people are connected if they share a circle, checked in at the same hosted plan, or met through a past invitation.
create or replace function public.out_connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select out_circle_mates(a, b)
  or exists (select 1 from out_rsvps r1 join out_rsvps r2 on r1.event_id = r2.event_id
             where r1.user_id = a and r2.user_id = b and r1.checked_in_at is not null and r2.checked_in_at is not null)
  or exists (select 1 from out_asks k where k.when_at < now()
             and (k.by_user = a or a = any(k.joins)) and (k.by_user = b or b = any(k.joins)))
$$;

create or replace function public.out_can_see_ask(owner uuid, ring text, invite uuid[], joins uuid[]) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() = owner or auth.uid() = any(joins) or out_is_admin()
  or (out_me_ok(false) and (
       auth.uid() = any(invite)
    or (ring = 'everyone' and out_me_ok(true))
    or (ring = 'circles' and out_circle_mates(owner, auth.uid()))
    or (ring = 'met' and out_connected(owner, auth.uid()))))
$$;

create or replace function public.out_notify(u uuid, body text, link text default null) returns void
language sql security definer set search_path = public as $$
  insert into out_notes (user_id, body, link) values (u, body, link)
$$;
revoke execute on function public.out_notify(uuid, text, text) from public, anon, authenticated;

-- ============ TRIGGERS ============
-- Only the host can change verification, pauses, strikes and passes.
create or replace function public.out_profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if out_is_admin() then
    if tg_op = 'UPDATE' and new.verified and not old.verified then
      perform out_notify(new.id, 'You''re verified. Women-only plans and Who''s down are open to you now.', '#down');
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verified := false; new.suspended := false; new.strike_reset := 0; new.pass_until := null;
    if new.invited_by is not null and (new.invited_by = new.id
       or (select count(*) from out_profiles where invited_by = new.invited_by) >= 3) then
      new.invited_by := null;
    end if;
  else
    new.verified := old.verified; new.suspended := old.suspended; new.strike_reset := old.strike_reset;
    new.pass_until := old.pass_until; new.invite_code := old.invite_code; new.invited_by := old.invited_by;
  end if;
  return new;
end $$;
drop trigger if exists out_profiles_guard on public.out_profiles;
create trigger out_profiles_guard before insert or update on public.out_profiles
for each row execute function public.out_profiles_guard();

-- Works out the price, the waitlist and what guests may change on their own spot.
create or replace function public.out_rsvps_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev out_events; taken int; prof out_profiles; noshows int;
begin
  select * into ev from out_events where id = new.event_id;
  if tg_op = 'INSERT' then
    if not out_is_admin() then
      select * into prof from out_profiles where id = new.user_id;
      if prof.id is null or prof.suspended then raise exception 'Your account is paused.'; end if;
      if ev.women_only and not (prof.is_woman and prof.verified) then raise exception 'Women-only plans need a verified profile.'; end if;
      select count(*) into noshows from out_rsvps r join out_events e on e.id = r.event_id
        where r.user_id = new.user_id and r.paid and r.checked_in_at is null and r.status <> 'cancelled' and e.starts_at < now() - interval '3 hours';
      if noshows - prof.strike_reset >= 2 then raise exception 'Joining is paused after two no-shows. Message the host.'; end if;
      new.paid := false; new.sent := false; new.checked_in_at := null; new.home_safe_at := null;
    end if;
    select count(*) into taken from out_rsvps where event_id = new.event_id and status in ('requested','confirmed');
    new.status := case when taken >= ev.cap then 'waitlist' else 'requested' end;
    select * into prof from out_profiles where id = new.user_id;
    new.amount := case
      when prof.pass_until is not null and prof.pass_until >= (ev.starts_at at time zone 'Africa/Lagos')::date then 0
      when not exists (select 1 from out_rsvps where user_id = new.user_id and paid) then
        greatest(ev.fee, (select first_fee from out_settings where id = 1))
      else ev.fee end;
    if new.amount = 0 and new.status = 'requested' then new.paid := true; new.status := 'confirmed'; end if;
    return new;
  end if;
  -- UPDATE
  if not out_is_admin() and coalesce(current_setting('out.rpc', true), '') <> '1' then
    new.paid := old.paid; new.amount := old.amount; new.event_id := old.event_id; new.user_id := old.user_id;
    if new.status <> old.status then
      if new.status = 'cancelled' then null;
      elsif old.status = 'cancelled' and new.status = 'requested' then
        select count(*) into taken from out_rsvps where event_id = new.event_id and status in ('requested','confirmed') and id <> new.id;
        if taken >= ev.cap then new.status := 'waitlist'; elsif old.paid then new.status := 'confirmed'; end if;
      else new.status := old.status; end if;
    end if;
    if new.checked_in_at is distinct from old.checked_in_at and not old.paid then new.checked_in_at := old.checked_in_at; end if;
  elsif new.paid and not old.paid then
    if new.status in ('requested','waitlist') then new.status := 'confirmed'; end if;
    perform out_notify(new.user_id, 'Your spot at ' || ev.title || ' is confirmed.', '#plans');
  end if;
  return new;
end $$;
drop trigger if exists out_rsvps_guard on public.out_rsvps;
create trigger out_rsvps_guard before insert or update on public.out_rsvps
for each row execute function public.out_rsvps_guard();

-- When someone drops out, the first person on the waitlist moves up.
create or replace function public.out_rsvps_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare nxt out_rsvps; ev out_events; taken int;
begin
  if new.status = 'cancelled' and old.status in ('requested','confirmed') then
    select * into ev from out_events where id = new.event_id;
    select count(*) into taken from out_rsvps where event_id = new.event_id and status in ('requested','confirmed');
    if taken < ev.cap then
      select * into nxt from out_rsvps where event_id = new.event_id and status = 'waitlist' order by created_at limit 1;
      if nxt.id is not null then
        perform set_config('out.rpc', '1', true);
        update out_rsvps set status = case when paid then 'confirmed' else 'requested' end where id = nxt.id;
        perform set_config('out.rpc', '', true);
        perform out_notify(nxt.user_id, 'A spot opened at ' || ev.title || '. It''s yours.', '#plans');
      end if;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists out_rsvps_after on public.out_rsvps;
create trigger out_rsvps_after after update on public.out_rsvps
for each row execute function public.out_rsvps_after();

create or replace function public.out_feedback_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r out_rsvps;
begin
  select * into r from out_rsvps where id = new.rsvp_id;
  new.event_id := r.event_id; new.user_id := r.user_id;
  if not out_is_admin() and (r.user_id <> auth.uid() or r.checked_in_at is null) then
    raise exception 'You can answer after you check in.';
  end if;
  return new;
end $$;
drop trigger if exists out_feedback_guard on public.out_feedback;
create trigger out_feedback_guard before insert or update on public.out_feedback
for each row execute function public.out_feedback_guard();

create or replace function public.out_ask_fb_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k out_asks;
begin
  select * into k from out_asks where id = new.ask_id;
  new.user_id := auth.uid();
  if k.id is null or k.when_at > now() or not (k.by_user = auth.uid() or auth.uid() = any(k.joins)) then
    raise exception 'You can answer after the meetup.';
  end if;
  return new;
end $$;
drop trigger if exists out_ask_fb_guard on public.out_ask_fb;
create trigger out_ask_fb_guard before insert or update on public.out_ask_fb
for each row execute function public.out_ask_fb_guard();

create or replace function public.out_asks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if tg_op = 'INSERT' then
    new.joins := '{}';
    if not out_is_admin() then
      new.by_user := auth.uid();
      if not out_me_ok(true) then raise exception 'Invitations open once the host has verified you.'; end if;
    end if;
    if new.ring = 'invite' then
      foreach u in array new.invite loop
        perform out_notify(u, (select name from out_profiles where id = new.by_user) || ' invited you: ' || new.what, '#ask-' || new.id);
      end loop;
    end if;
    return new;
  end if;
  if not out_is_admin() and coalesce(current_setting('out.rpc', true), '') <> '1' then
    new.joins := old.joins; new.by_user := old.by_user; new.invite := old.invite;
  end if;
  return new;
end $$;
drop trigger if exists out_asks_guard on public.out_asks;
create trigger out_asks_guard before insert or update on public.out_asks
for each row execute function public.out_asks_guard();

create or replace function public.out_circles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare m uuid;
begin
  if out_is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid(); new.history := '[]'; new.host_idx := 0;
    if not (auth.uid() = any(new.members)) then raise exception 'You have to be in the circle.'; end if;
    foreach m in array new.members loop
      if m <> auth.uid() and not out_connected(auth.uid(), m) then raise exception 'You can only start a circle with people you''ve met.'; end if;
    end loop;
  else
    new.members := old.members; new.created_by := old.created_by;
  end if;
  return new;
end $$;
drop trigger if exists out_circles_guard on public.out_circles;
create trigger out_circles_guard before insert or update on public.out_circles
for each row execute function public.out_circles_guard();

-- ============ ACTIONS THE APP CALLS ============
create or replace function public.out_join_ask(aid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k out_asks;
begin
  select * into k from out_asks where id = aid for update;
  if k.id is null or k.status <> 'open' or k.when_at < now() then raise exception 'This invitation has closed.'; end if;
  if not out_can_see_ask(k.by_user, k.ring, k.invite, k.joins) then raise exception 'This invitation isn''t open to you.'; end if;
  if not out_me_ok(true) then raise exception 'Invitations open once the host has verified you.'; end if;
  if auth.uid() = k.by_user or auth.uid() = any(k.joins) then return; end if;
  if cardinality(k.joins) >= k.seats then raise exception 'It just filled up.'; end if;
  perform set_config('out.rpc', '1', true);
  update out_asks set joins = array_append(joins, auth.uid()) where id = aid;
  perform set_config('out.rpc', '', true);
  perform out_notify(k.by_user, (select name from out_profiles where id = auth.uid()) || ' is down for ' || k.what || '.', '#ask-' || aid);
end $$;

create or replace function public.out_leave_ask(aid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('out.rpc', '1', true);
  update out_asks set joins = array_remove(joins, auth.uid()) where id = aid and auth.uid() = any(joins);
  perform set_config('out.rpc', '', true);
end $$;

create or replace function public.out_leave_circle(cid uuid) returns void
language sql security definer set search_path = public as $$
  update out_circles set members = array_remove(members, auth.uid()) where id = cid and auth.uid() = any(members)
$$;

-- WhatsApp numbers of the people in an invitation or circle you belong to.
create or replace function public.out_crew_contacts(aid uuid default null, cid uuid default null)
returns table (user_id uuid, name text, phone text)
language sql stable security definer set search_path = public as $$
  with crew as (
    select unnest(array_append(joins, by_user)) u from out_asks
      where id = aid and (by_user = auth.uid() or auth.uid() = any(joins))
    union
    select unnest(members) from out_circles where id = cid and auth.uid() = any(members)
  )
  select p.id, p.name, v.phone from crew join out_profiles p on p.id = crew.u join out_private v on v.id = p.id
  where p.id <> auth.uid()
$$;

-- Everyone you've met, how often, and whether you both said you'd meet again.
create or replace function public.out_my_people()
returns table (person uuid, times bigint, last_what text, last_at timestamptz, mutual boolean)
language sql stable security definer set search_path = public as $$
  with meets as (
    select r2.user_id p, e.title w, e.starts_at t
      from out_rsvps r1 join out_rsvps r2 on r1.event_id = r2.event_id and r2.user_id <> r1.user_id
      join out_events e on e.id = r1.event_id
      where r1.user_id = auth.uid() and r1.checked_in_at is not null and r2.checked_in_at is not null
    union all
    select x, k.what, k.when_at from out_asks k, unnest(array_append(k.joins, k.by_user)) x
      where k.when_at < now() and (k.by_user = auth.uid() or auth.uid() = any(k.joins)) and x <> auth.uid()
    union all
    select m, h->>'what', (h->>'when_at')::timestamptz from out_circles c, jsonb_array_elements(c.history) h, unnest(c.members) m
      where auth.uid() = any(c.members) and m <> auth.uid()
  )
  select p, count(*), (array_agg(w order by t desc))[1], max(t),
    exists (select 1 from out_feedback f1 join out_feedback f2 on f1.event_id = f2.event_id
            where f1.user_id = auth.uid() and f2.user_id = meets.p
              and meets.p = any(f1.meet_again) and auth.uid() = any(f2.meet_again))
    or exists (select 1 from out_ask_fb a1 join out_ask_fb a2 on a1.ask_id = a2.ask_id
            where a1.user_id = auth.uid() and a2.user_id = meets.p
              and meets.p = any(a1.meet_again) and auth.uid() = any(a2.meet_again))
  from meets group by p
$$;

create or replace function public.out_code_owner(code text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from out_profiles where invite_code = lower(trim(code)) and not suspended
$$;

create or replace function public.out_my_invites() returns table (code text, used bigint)
language sql stable security definer set search_path = public as $$
  select invite_code, (select count(*) from out_profiles x where x.invited_by = p.id) from out_profiles p where p.id = auth.uid()
$$;

-- Host only: tell everyone in a city who wants something that a plan is ready.
create or replace function public.out_notify_wanters(want text, in_city text, msg text, lnk text) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; p record;
begin
  if not out_is_admin() then raise exception 'Host only.'; end if;
  for p in select id from out_profiles where city = in_city and want = any(wants) and not suspended loop
    perform out_notify(p.id, msg, lnk); n := n + 1;
  end loop;
  return n;
end $$;

-- ============ COLUMN ACCESS ============
-- Invite codes stay private; everything else on a profile is visible to signed-in members.
revoke select on public.out_profiles from anon, authenticated;
grant select (id, name, city, age_band, is_woman, wants, invited_by, ref_note, verified, suspended, strike_reset, pass_until, created_at)
  on public.out_profiles to authenticated;
grant insert, update, delete on public.out_profiles to authenticated;

-- ============ ROW-LEVEL SECURITY ============
alter table public.out_admins enable row level security;
alter table public.out_settings enable row level security;
alter table public.out_profiles enable row level security;
alter table public.out_private enable row level security;
alter table public.out_events enable row level security;
alter table public.out_rsvps enable row level security;
alter table public.out_feedback enable row level security;
alter table public.out_asks enable row level security;
alter table public.out_ask_fb enable row level security;
alter table public.out_circles enable row level security;
alter table public.out_happenings enable row level security;
alter table public.out_reports enable row level security;
alter table public.out_notes enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename like 'out\_%' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "admins see themselves" on public.out_admins for select to authenticated using (user_id = auth.uid());

create policy "members read settings" on public.out_settings for select to authenticated using (true);
create policy "host edits settings" on public.out_settings for update to authenticated using (out_is_admin());

create policy "members read profiles" on public.out_profiles for select to authenticated using (true);
create policy "create own profile" on public.out_profiles for insert to authenticated with check (id = auth.uid());
create policy "edit own profile" on public.out_profiles for update to authenticated using (id = auth.uid() or out_is_admin());
create policy "delete own profile" on public.out_profiles for delete to authenticated using (id = auth.uid() or out_is_admin());

create policy "own or host reads contacts" on public.out_private for select to authenticated using (id = auth.uid() or out_is_admin());
create policy "write own contacts" on public.out_private for insert to authenticated with check (id = auth.uid());
create policy "edit own contacts" on public.out_private for update to authenticated using (id = auth.uid());

create policy "members read plans" on public.out_events for select to authenticated using (true);
create policy "host writes plans" on public.out_events for all to authenticated using (out_is_admin()) with check (out_is_admin());

create policy "members read spots" on public.out_rsvps for select to authenticated using (true);
create policy "take own spot" on public.out_rsvps for insert to authenticated with check (user_id = auth.uid() or out_is_admin());
create policy "edit own spot" on public.out_rsvps for update to authenticated using (user_id = auth.uid() or out_is_admin());
create policy "host removes spots" on public.out_rsvps for delete to authenticated using (out_is_admin());

create policy "own or host reads answers" on public.out_feedback for select to authenticated using (user_id = auth.uid() or out_is_admin());
create policy "write own answers" on public.out_feedback for insert to authenticated with check (true);
create policy "edit own answers" on public.out_feedback for update to authenticated using (user_id = auth.uid() or out_is_admin());

create policy "see invitations meant for you" on public.out_asks for select to authenticated using (out_can_see_ask(by_user, ring, invite, joins));
create policy "post invitations" on public.out_asks for insert to authenticated with check (true);
create policy "edit own invitations" on public.out_asks for update to authenticated using (by_user = auth.uid() or out_is_admin());
create policy "delete own invitations" on public.out_asks for delete to authenticated using (by_user = auth.uid() or out_is_admin());

create policy "own meetup answers" on public.out_ask_fb for select to authenticated using (user_id = auth.uid() or out_is_admin());
create policy "answer after meetups" on public.out_ask_fb for insert to authenticated with check (true);
create policy "edit own meetup answers" on public.out_ask_fb for update to authenticated using (user_id = auth.uid());

create policy "members see their circles" on public.out_circles for select to authenticated using (auth.uid() = any(members) or out_is_admin());
create policy "start circles" on public.out_circles for insert to authenticated with check (true);
create policy "members update circles" on public.out_circles for update to authenticated using (auth.uid() = any(members) or out_is_admin());
create policy "host deletes circles" on public.out_circles for delete to authenticated using (out_is_admin());

create policy "anyone reads listings" on public.out_happenings for select to anon, authenticated using (true);
create policy "host writes listings" on public.out_happenings for all to authenticated using (out_is_admin()) with check (out_is_admin());

create policy "send reports" on public.out_reports for insert to authenticated with check (by_user = auth.uid());
create policy "host reads reports" on public.out_reports for select to authenticated using (out_is_admin());
create policy "host resolves reports" on public.out_reports for update to authenticated using (out_is_admin());

create policy "read own notifications" on public.out_notes for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications" on public.out_notes for update to authenticated using (user_id = auth.uid());

grant select on public.out_happenings to anon;

-- ============ STARTING DATA ============
insert into public.out_events (title, city, kind, starts_at, area, cap, fee, budget, ages, women_only, notes)
select * from (values
  ('Saturday brunch & new friends', 'Abuja', 'eat', '2026-12-05 11:00+01'::timestamptz, 'Wuse 2', 6, 0, '₦8,000–₦15,000', 'Ages 25–34', true, 'Pilot plan 1 of 3.'),
  ('Sunday reading hour', 'Abuja', 'read', '2026-12-06 15:00+01', 'Jabi', 5, 0, '₦3,000–₦6,000', 'Any adult age', false, 'Bring whatever you''re reading.'),
  ('Morning walk at Jabi Lake', 'Abuja', 'move', '2026-12-12 07:00+01', 'Jabi', 8, 0, 'Free', 'Any adult age', true, 'Easy pace, about 45 minutes.')
) v(title, city, kind, starts_at, area, cap, fee, budget, ages, women_only, notes)
where not exists (select 1 from public.out_events);

insert into public.out_happenings (id, title, city, start_date, end_date, venue, price, link, note) values
  ('h-wizkid-abj', 'Wizkid at Live Out Loud Music Festival', 'Abuja', '2026-12-13', null, 'Eagle Square', 'Standard tickets ₦50,000 on Tix Africa', 'https://www.riotimesonline.com/wizkid-abuja-eagle-square-concert-2026/', null),
  ('h-apitainment', 'Apitainment Music Festival with Seyi Vibez', 'Abuja', '2026-12-19', null, 'Abuja Velodrome', null, 'https://guardian.ng/?p=2954676', null),
  ('h-add-arts', 'Urban Arts Festival (Abuja Detty December)', 'Abuja', '2026-12-26', null, null, null, 'https://leadership.ng/abuja-detty-december-debuts/', 'Same day as the ADD Ignite Party.'),
  ('h-add-fit', 'Abuja FitFest (Abuja Detty December)', 'Abuja', '2026-12-27', null, null, null, 'https://leadership.ng/abuja-detty-december-debuts/', 'Good one to go to with a running or gym buddy.'),
  ('h-davido', 'Davido: Oriadè, The Residency', 'Lagos', '2026-12-17', '2026-12-19', 'National Theatre, Iganmu', 'Ticket prices not announced yet', 'https://guardian.ng/?p=2919857', 'Three nights.'),
  ('h-ddfest', 'Detty December Fest (Wizkid opens on the 18th)', 'Lagos', '2026-12-18', '2026-12-30', 'Detty December Village, Ilubirin', null, 'https://africa.com/entertainment/wizkid-to-open-detty-december-fest-2026-as-lagos-13-day-two-stage-festival-returns', '13 days, two stages. Opening concert at 6pm.'),
  ('h-brandy', 'Flytime House of R&B with Brandy', 'Lagos', '2026-12-20', null, 'Eko Convention Centre', null, 'https://leadership.ng/?p=750087', null),
  ('h-afrojazz', 'AfroJazz Fest: To the Roots', 'Lagos', '2026-12-23', null, null, null, 'https://notjustok.com/?p=526026', null)
on conflict (id) do nothing;
