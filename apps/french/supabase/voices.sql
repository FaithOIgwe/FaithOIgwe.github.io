-- Cahier: native-speaker voice studio.
-- Run once in Supabase (SQL Editor › New query › Run), after schema.sql.

-- People allowed to record the course audio. Add them with the snippet at the bottom.
create table if not exists public.voice_recorders (
  user_id uuid primary key references auth.users(id) on delete cascade,
  speaker_name text not null check (char_length(speaker_name) between 2 and 60)
);

-- One recording per line of course text; every learner hears it.
create table if not exists public.voice_clips (
  text_key text primary key check (char_length(text_key) <= 2000),
  path text not null,
  speaker_name text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.voice_recorders enable row level security;
alter table public.voice_clips enable row level security;

drop policy if exists "recorders see their own row" on public.voice_recorders;
create policy "recorders see their own row" on public.voice_recorders for select to authenticated using (user_id = auth.uid());

drop policy if exists "everyone can read clips" on public.voice_clips;
drop policy if exists "recorders add clips" on public.voice_clips;
drop policy if exists "recorders replace clips" on public.voice_clips;
drop policy if exists "recorders remove clips" on public.voice_clips;
create policy "everyone can read clips" on public.voice_clips for select to anon, authenticated using (true);
create policy "recorders add clips" on public.voice_clips for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.voice_recorders r where r.user_id = auth.uid()));
create policy "recorders replace clips" on public.voice_clips for update to authenticated
  using (exists (select 1 from public.voice_recorders r where r.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.voice_recorders r where r.user_id = auth.uid()));
create policy "recorders remove clips" on public.voice_clips for delete to authenticated
  using (exists (select 1 from public.voice_recorders r where r.user_id = auth.uid()));

-- Public bucket: anyone can play the audio; only recorders can upload or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voices', 'voices', true, 10485760, array['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav','audio/x-m4a'])
on conflict (id) do nothing;

drop policy if exists "recorders upload voices" on storage.objects;
drop policy if exists "recorders delete voices" on storage.objects;
create policy "recorders upload voices" on storage.objects for insert to authenticated
  with check (bucket_id = 'voices' and exists (select 1 from public.voice_recorders r where r.user_id = auth.uid()));
create policy "recorders delete voices" on storage.objects for delete to authenticated
  using (bucket_id = 'voices' and exists (select 1 from public.voice_recorders r where r.user_id = auth.uid()));

-- ============ ADD A RECORDER ============
-- 1. The native speaker creates an account in the app (Sign in › Create account) and confirms their email.
-- 2. Change the email and name below, then run just these two lines:
-- insert into public.voice_recorders (user_id, speaker_name)
-- select id, 'Speaker name' from auth.users where email = 'speaker@example.com';
