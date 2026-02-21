-- Tabulka pro ukládání Figma OAuth tokenů per uživatel
create table if not exists public.figma_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint figma_tokens_user_id_key unique (user_id)
);

-- RLS
alter table public.figma_tokens enable row level security;

-- Uživatel vidí jen svůj token
create policy "Users can view own figma token"
  on public.figma_tokens for select
  using (auth.uid() = user_id);

-- Service role může dělat vše (Edge Function)
create policy "Service role full access"
  on public.figma_tokens for all
  using (true)
  with check (true);

-- Storage bucket pro Figma SVG exporty
insert into storage.buckets (id, name, public)
values ('figma-svgs', 'figma-svgs', true)
on conflict (id) do nothing;

-- Storage policy
create policy "Anyone can read figma SVGs"
  on storage.objects for select
  using (bucket_id = 'figma-svgs');

create policy "Service role can upload figma SVGs"
  on storage.objects for insert
  with check (bucket_id = 'figma-svgs');

create policy "Service role can update figma SVGs"
  on storage.objects for update
  using (bucket_id = 'figma-svgs');
