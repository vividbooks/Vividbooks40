-- Server-side tombstones to prevent "zombie" items across browsers.
-- When a client deletes an item but the actual DELETE fails/offline, the tombstone still propagates the delete.

create table if not exists public.teacher_deleted_items (
  teacher_id uuid not null,
  item_type text not null,
  item_id text not null,
  deleted_at timestamptz not null default now(),
  client_id text null,
  primary key (teacher_id, item_type, item_id)
);

alter table public.teacher_deleted_items enable row level security;

-- RLS: only the owner can see/write their tombstones
drop policy if exists "teacher_deleted_items_select_own" on public.teacher_deleted_items;
create policy "teacher_deleted_items_select_own"
on public.teacher_deleted_items
for select
using (auth.uid() = teacher_id);

drop policy if exists "teacher_deleted_items_insert_own" on public.teacher_deleted_items;
create policy "teacher_deleted_items_insert_own"
on public.teacher_deleted_items
for insert
with check (auth.uid() = teacher_id);

drop policy if exists "teacher_deleted_items_update_own" on public.teacher_deleted_items;
create policy "teacher_deleted_items_update_own"
on public.teacher_deleted_items
for update
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

drop policy if exists "teacher_deleted_items_delete_own" on public.teacher_deleted_items;
create policy "teacher_deleted_items_delete_own"
on public.teacher_deleted_items
for delete
using (auth.uid() = teacher_id);




