-- X 只读连接：密文由应用服务器生成，数据库从不保存明文令牌。
create table public.x_read_connections (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  token_ciphertext text not null,
  x_user_id text check (x_user_id is null or x_user_id ~ '^[0-9]{1,19}$'),
  last_post_id text check (last_post_id is null or last_post_id ~ '^[0-9]{1,19}$'),
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.x_read_connections enable row level security;
create policy x_connections_owner_select on public.x_read_connections for select to authenticated
  using (private.is_workspace_owner(workspace_id));
create policy x_connections_owner_insert on public.x_read_connections for insert to authenticated
  with check (private.is_workspace_owner(workspace_id));
create policy x_connections_owner_update on public.x_read_connections for update to authenticated
  using (private.is_workspace_owner(workspace_id))
  with check (private.is_workspace_owner(workspace_id));
grant select, insert, update on public.x_read_connections to authenticated;
