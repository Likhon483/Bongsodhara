-- UUID extension
create extension if not exists "pgcrypto";

-- 1. Trees table
create table if not exists public.trees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title_bn text not null,
  description_bn text,
  root_person_id uuid,
  is_public boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Persons table
create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  full_name_bn text not null,
  nickname_bn text,
  gender text not null check (gender in ('male', 'female', 'other')),
  birth_date_ad date,
  birth_date_bs text,
  death_date_ad date,
  is_alive boolean not null default true,
  hometown_bn text,
  occupation_bn text,
  bio_bn text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Add foreign key for root_person_id after persons exists
alter table public.trees
  drop constraint if exists trees_root_person_fkey,
  add constraint trees_root_person_fkey
  foreign key (root_person_id) references public.persons(id) on delete set null;

-- 3. Unions (Marriage / Partnership) table
create table if not exists public.unions (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  partner_1_id uuid not null references public.persons(id) on delete cascade,
  partner_2_id uuid not null references public.persons(id) on delete cascade,
  marriage_date_ad date,
  status text not null default 'married' check (status in ('married', 'divorced', 'widowed', 'other')),
  created_at timestamptz not null default now(),
  constraint different_partners check (partner_1_id <> partner_2_id)
);

-- 4. Parent-Child table
create table if not exists public.parent_child (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  union_id uuid references public.unions(id) on delete set null,
  parent_id uuid not null references public.persons(id) on delete cascade,
  child_id uuid not null references public.persons(id) on delete cascade,
  relation_type text not null default 'biological' check (relation_type in ('biological', 'adopted', 'step')),
  created_at timestamptz not null default now(),
  constraint different_parent_child check (parent_id <> child_id),
  constraint unique_parent_child unique (tree_id, parent_id, child_id)
);

-- Indexes for fast traversal
create index if not exists idx_persons_tree on public.persons(tree_id);
create index if not exists idx_unions_tree on public.unions(tree_id);
create index if not exists idx_unions_partners on public.unions(partner_1_id, partner_2_id);
create index if not exists idx_parent_child_tree on public.parent_child(tree_id);
create index if not exists idx_parent_child_parent on public.parent_child(parent_id);
create index if not exists idx_parent_child_child on public.parent_child(child_id);

-- Enable Row Level Security
alter table public.trees enable row level security;
alter table public.persons enable row level security;
alter table public.unions enable row level security;
alter table public.parent_child enable row level security;

-- Grant access to authenticated and anon roles (RLS will restrict what rows they can see/modify)
grant usage on schema public to anon, authenticated;
grant all on table public.trees to anon, authenticated;
grant all on table public.persons to anon, authenticated;
grant all on table public.unions to anon, authenticated;
grant all on table public.parent_child to anon, authenticated;

-- Policies for trees
create policy "Trees viewable by owner or if public"
  on public.trees for select
  using (auth.uid() = owner_id or is_public = true);

create policy "Users can insert own trees"
  on public.trees for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own trees"
  on public.trees for update
  using (auth.uid() = owner_id);

create policy "Users can delete own trees"
  on public.trees for delete
  using (auth.uid() = owner_id);

-- Helper check: is user owner or tree is public (read)
create policy "Persons readable if tree accessible"
  on public.persons for select
  using (
    exists (
      select 1 from public.trees t
      where t.id = persons.tree_id and (t.owner_id = auth.uid() or t.is_public = true)
    )
  );

create policy "Persons writable by tree owner"
  on public.persons for all
  using (
    exists (
      select 1 from public.trees t
      where t.id = persons.tree_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trees t
      where t.id = persons.tree_id and t.owner_id = auth.uid()
    )
  );

-- Unions policies
create policy "Unions readable if tree accessible"
  on public.unions for select
  using (
    exists (
      select 1 from public.trees t
      where t.id = unions.tree_id and (t.owner_id = auth.uid() or t.is_public = true)
    )
  );

create policy "Unions writable by tree owner"
  on public.unions for all
  using (
    exists (
      select 1 from public.trees t
      where t.id = unions.tree_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trees t
      where t.id = unions.tree_id and t.owner_id = auth.uid()
    )
  );

-- Parent-child policies
create policy "Parent-child readable if tree accessible"
  on public.parent_child for select
  using (
    exists (
      select 1 from public.trees t
      where t.id = parent_child.tree_id and (t.owner_id = auth.uid() or t.is_public = true)
    )
  );

create policy "Parent-child writable by tree owner"
  on public.parent_child for all
  using (
    exists (
      select 1 from public.trees t
      where t.id = parent_child.tree_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trees t
      where t.id = parent_child.tree_id and t.owner_id = auth.uid()
    )
  );


-- ==========================================================
-- Collaboration & Avatars Storage Extension
-- ==========================================================

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
