-- 旧版浏览器想法/选题的只读快照。导入后不删除旧本机数据。
create table public.legacy_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('thought', 'topic')),
  legacy_id text not null,
  origin text not null check (origin in ('browser', 'legacy_kv')),
  content_hash text not null,
  payload jsonb not null,
  imported_at timestamptz not null default now(),
  unique (workspace_id, kind, legacy_id, content_hash)
);

create index legacy_items_recent_idx on public.legacy_items (workspace_id, kind, imported_at desc);
alter table public.legacy_items enable row level security;
create policy legacy_items_select on public.legacy_items for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy legacy_items_insert on public.legacy_items for insert to authenticated
with check (private.is_workspace_owner(workspace_id));
grant select, insert on public.legacy_items to authenticated;
