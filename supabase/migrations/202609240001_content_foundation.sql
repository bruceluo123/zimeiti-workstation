-- 麦满分 V2 的独立内容空间。运行于专用 Supabase 项目，不复用招聘系统。
create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '麦满分工作站',
  created_at timestamptz not null default now(),
  unique (owner_id)
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_owner(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

create or replace function public.can_edit_workspace(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace and user_id = (select auth.uid()) and role in ('owner', 'editor')
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
revoke all on function public.can_edit_workspace(uuid) from public;
grant execute on function public.is_workspace_member(uuid), public.is_workspace_owner(uuid), public.can_edit_workspace(uuid) to authenticated;

create or replace function public.create_personal_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_workspace uuid;
begin
  insert into public.workspaces (owner_id) values (new.id) returning id into new_workspace;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created_workspace
after insert on auth.users for each row execute function public.create_personal_workspace();

-- 一条原始内容可以有多个版本；平台镜像永远引用明确版本。
create table public.content_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  origin_platform text not null check (origin_platform in ('x', 'manual', 'web')),
  external_id text,
  source_url text,
  ownership text not null check (ownership in ('mine', 'reference')),
  content_type text not null default 'text' check (content_type in ('text', 'image', 'video', 'link')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, origin_platform, external_id)
);

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_id uuid not null references public.content_sources(id) on delete cascade,
  body text not null,
  content_hash text not null,
  media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, content_hash),
  unique (id, workspace_id, source_id)
);

create table public.mirror_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_id uuid not null references public.content_sources(id) on delete cascade,
  revision_id uuid not null,
  target_platform text not null check (target_platform = 'weibo'),
  target_account_id text not null,
  intent_generation integer not null default 0 check (intent_generation >= 0),
  body text not null,
  manually_edited boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'handoff_pending', 'reported_published', 'skipped')),
  published_url text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source_id, target_platform, target_account_id, intent_generation),
  foreign key (revision_id, workspace_id, source_id)
    references public.content_revisions (id, workspace_id, source_id)
);

create index content_sources_recent_idx on public.content_sources (workspace_id, created_at desc);
create index mirror_drafts_queue_idx on public.mirror_drafts (workspace_id, status, created_at desc);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.content_sources enable row level security;
alter table public.content_revisions enable row level security;
alter table public.mirror_drafts enable row level security;

create policy workspaces_select on public.workspaces for select to authenticated
using (public.is_workspace_member(id));
create policy members_select on public.workspace_members for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy sources_select on public.content_sources for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy sources_insert on public.content_sources for insert to authenticated
with check (public.can_edit_workspace(workspace_id));
create policy sources_update on public.content_sources for update to authenticated
using (public.can_edit_workspace(workspace_id)) with check (public.can_edit_workspace(workspace_id));

create policy revisions_select on public.content_revisions for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy revisions_insert on public.content_revisions for insert to authenticated
with check (
  public.can_edit_workspace(workspace_id)
  and exists (select 1 from public.content_sources s where s.id = source_id and s.workspace_id = workspace_id)
);

create policy drafts_select on public.mirror_drafts for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy drafts_insert on public.mirror_drafts for insert to authenticated
with check (
  public.is_workspace_owner(workspace_id)
  and exists (select 1 from public.content_sources s where s.id = source_id and s.workspace_id = workspace_id and s.ownership = 'mine')
);
create policy drafts_update on public.mirror_drafts for update to authenticated
using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

-- 不给客户端删除来源或镜像草稿的权限。未来用审计 API 做安全删除。
grant select on public.workspaces, public.workspace_members, public.content_sources, public.content_revisions, public.mirror_drafts to authenticated;
grant insert, update on public.content_sources, public.mirror_drafts to authenticated;
grant insert on public.content_revisions to authenticated;

-- 手动录入只作过渡入口，原文不经过模型，来源与镜像草稿同一事务落库。
create or replace function public.save_manual_original(
  input_body text,
  input_source_url text,
  input_external_id text,
  input_target_account_id text
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  current_workspace uuid;
  current_source uuid;
  current_revision uuid;
  current_draft uuid;
  normalized_body text := input_body;
  body_hash text;
begin
  if normalized_body is null or length(btrim(normalized_body)) = 0 or length(normalized_body) > 20000 then
    raise exception '正文不能为空，且最多 20000 字';
  end if;
  if input_target_account_id is null or input_target_account_id !~ '^[0-9]{5,20}$' then
    raise exception '目标微博 UID 不合法';
  end if;
  select id into current_workspace from public.workspaces where owner_id = (select auth.uid());
  if current_workspace is null then raise exception '没有可编辑的工作空间'; end if;
  body_hash := encode(public.digest(normalized_body, 'sha256'), 'hex');

  insert into public.content_sources (workspace_id, origin_platform, external_id, source_url, ownership)
  values (current_workspace, 'manual', nullif(input_external_id, ''), nullif(input_source_url, ''), 'mine')
  on conflict (workspace_id, origin_platform, external_id) do update
    set updated_at = now()
  returning id into current_source;

  insert into public.content_revisions (workspace_id, source_id, body, content_hash)
  values (current_workspace, current_source, normalized_body, body_hash)
  on conflict (source_id, content_hash) do update set body = excluded.body
  returning id into current_revision;

  insert into public.mirror_drafts
    (workspace_id, source_id, revision_id, target_platform, target_account_id, body)
  values
    (current_workspace, current_source, current_revision, 'weibo', input_target_account_id, normalized_body)
  on conflict (workspace_id, source_id, target_platform, target_account_id, intent_generation)
    do update set revision_id = excluded.revision_id, body = excluded.body, updated_at = now()
    where mirror_drafts.status = 'draft' and not mirror_drafts.manually_edited
  returning id into current_draft;

  if current_draft is null then
    select id into current_draft from public.mirror_drafts
    where workspace_id = current_workspace and source_id = current_source
      and target_platform = 'weibo' and target_account_id = input_target_account_id
      and intent_generation = 0;
  end if;
  return current_draft;
end;
$$;
revoke all on function public.save_manual_original(text, text, text, text) from public;
grant execute on function public.save_manual_original(text, text, text, text) to authenticated;
