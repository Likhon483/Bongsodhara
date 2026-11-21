-- ====================================================================
-- Migration: Add editor_token & Setup Avatars Storage Bucket with Policies
-- ====================================================================

-- 1. Add optional editor token for family collaboration
alter table public.trees
  add column if not exists editor_token text unique;

-- 2. Create avatars storage bucket (public read)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. Storage policies for avatars
drop policy if exists "Public avatar read" on storage.objects;
create policy "Public avatar read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Authenticated avatar upload" on storage.objects;
create policy "Authenticated avatar upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "Authenticated avatar update" on storage.objects;
create policy "Authenticated avatar update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars');
