-- Cahier: database setup for accounts, progress sync, recordings and the learner community.
-- Run once in Supabase: SQL Editor › New query › paste all of this › Run.

-- ============ TABLES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  level text not null default 'A1' check (level in ('A1','A2','B1','B2','C1','C2')),
  target text check (target in ('A2','B1','B2','C1','C2')),
  exam_month text check (exam_month ~ '^\d{4}-\d{2}$'),
  bio text check (char_length(bio) <= 280),
  looking_for_partner boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('questions','writing','partners','wins')),
  level text check (level in ('A1','A2','B1','B2','C1','C2')),
  body text not null check (char_length(body) between 1 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.replies (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null default auth.uid() references auth.users(id) on delete cascade,
  post_id bigint references public.posts(id) on delete cascade,
  reply_id bigint references public.replies(id) on delete cascade,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (reply_id is null)),
  unique (reporter, post_id),
  unique (reporter, reply_id)
);

create table if not exists public.recordings (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path text not null,
  label text check (char_length(label) <= 300),
  mime text,
  created_at timestamptz not null default now()
);

create index if not exists posts_channel_created_idx on public.posts (channel, created_at desc);
create index if not exists replies_post_idx on public.replies (post_id);
create index if not exists recordings_user_idx on public.recordings (user_id, created_at desc);

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles   enable row level security;
alter table public.progress   enable row level security;
alter table public.posts      enable row level security;
alter table public.replies    enable row level security;
alter table public.reports    enable row level security;
alter table public.recordings enable row level security;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
drop policy if exists "insert own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own progress" on public.progress;
create policy "own progress" on public.progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read visible posts" on public.posts;
drop policy if exists "create own posts" on public.posts;
drop policy if exists "delete own posts" on public.posts;
create policy "read visible posts" on public.posts for select to authenticated using (not hidden or user_id = auth.uid());
create policy "create own posts" on public.posts for insert to authenticated with check (user_id = auth.uid() and hidden = false);
create policy "delete own posts" on public.posts for delete to authenticated using (user_id = auth.uid());

drop policy if exists "read visible replies" on public.replies;
drop policy if exists "create own replies" on public.replies;
drop policy if exists "delete own replies" on public.replies;
create policy "read visible replies" on public.replies for select to authenticated using (not hidden or user_id = auth.uid());
create policy "create own replies" on public.replies for insert to authenticated with check (user_id = auth.uid() and hidden = false);
create policy "delete own replies" on public.replies for delete to authenticated using (user_id = auth.uid());

drop policy if exists "file reports" on public.reports;
create policy "file reports" on public.reports for insert to authenticated with check (reporter = auth.uid());

drop policy if exists "own recordings" on public.recordings;
create policy "own recordings" on public.recordings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ MODERATION AND LIMITS ============
-- Hide a post or reply automatically once three different people report it.
create or replace function public.hide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.post_id is not null and (select count(*) from public.reports where post_id = new.post_id) >= 3 then
    update public.posts set hidden = true where id = new.post_id;
  end if;
  if new.reply_id is not null and (select count(*) from public.reports where reply_id = new.reply_id) >= 3 then
    update public.replies set hidden = true where id = new.reply_id;
  end if;
  return new;
end $$;
drop trigger if exists on_report on public.reports;
create trigger on_report after insert on public.reports for each row execute function public.hide_reported();

-- Spam limits: 20 posts and 60 replies per person per day.
create or replace function public.limit_posts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.posts where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily post limit reached';
  end if;
  return new;
end $$;
drop trigger if exists posts_limit on public.posts;
create trigger posts_limit before insert on public.posts for each row execute function public.limit_posts();

create or replace function public.limit_replies() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.replies where user_id = new.user_id and created_at > now() - interval '1 day') >= 60 then
    raise exception 'Daily reply limit reached';
  end if;
  return new;
end $$;
drop trigger if exists replies_limit on public.replies;
create trigger replies_limit before insert on public.replies for each row execute function public.limit_replies();

-- Let a signed-in user delete their own account (everything above cascades).
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============ VOICE RECORDINGS STORAGE (private, 5 MB per file) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 5242880, array['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav','audio/x-m4a'])
on conflict (id) do nothing;

drop policy if exists "read own recordings" on storage.objects;
drop policy if exists "upload own recordings" on storage.objects;
drop policy if exists "update own recordings" on storage.objects;
drop policy if exists "delete own recordings" on storage.objects;
create policy "read own recordings" on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "upload own recordings" on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own recordings" on storage.objects for update to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own recordings" on storage.objects for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
