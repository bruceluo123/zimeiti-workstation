-- X -> 微博自动化：云端只读同步、人工初审、定时发布和可审计回写。
-- 自动任务只持有由服务器加密密钥派生出的短凭据；数据库仅保存其单向摘要。

create table public.automation_settings (
  singleton boolean primary key default true check (singleton),
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.automation_settings (singleton, secret_hash)
values (true, '473b3c113ef73bd027f3b5058c187aae6c299402a267902e6c186da636f4f771');

alter table public.automation_settings enable row level security;
revoke all on public.automation_settings from public, anon, authenticated;

create or replace function public.automation_secret_valid(input_secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select input_secret is not null and exists (
    select 1 from public.automation_settings
    where singleton and secret_hash = encode(extensions.digest(input_secret, 'sha256'), 'hex')
  );
$$;
revoke all on function public.automation_secret_valid(text) from public, anon, authenticated;

create table public.weibo_connections (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  weibo_user_id text not null check (weibo_user_id ~ '^[0-9]{5,20}$'),
  username text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  connected_at timestamptz not null default now(),
  last_verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.weibo_device_authorizations (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  device_code_ciphertext text not null,
  user_code text not null,
  verification_uri text not null check (verification_uri like 'https://open.weibo.com/%'),
  poll_interval_seconds integer not null default 5 check (poll_interval_seconds between 1 and 30),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.weibo_connections enable row level security;
alter table public.weibo_device_authorizations enable row level security;

create policy weibo_connections_select on public.weibo_connections for select to authenticated
using (private.is_workspace_owner(workspace_id));
create policy weibo_connections_insert on public.weibo_connections for insert to authenticated
with check (private.is_workspace_owner(workspace_id));
create policy weibo_connections_update on public.weibo_connections for update to authenticated
using (private.is_workspace_owner(workspace_id)) with check (private.is_workspace_owner(workspace_id));
create policy weibo_connections_delete on public.weibo_connections for delete to authenticated
using (private.is_workspace_owner(workspace_id));

create policy weibo_device_select on public.weibo_device_authorizations for select to authenticated
using (private.is_workspace_owner(workspace_id));
create policy weibo_device_insert on public.weibo_device_authorizations for insert to authenticated
with check (private.is_workspace_owner(workspace_id));
create policy weibo_device_update on public.weibo_device_authorizations for update to authenticated
using (private.is_workspace_owner(workspace_id)) with check (private.is_workspace_owner(workspace_id));
create policy weibo_device_delete on public.weibo_device_authorizations for delete to authenticated
using (private.is_workspace_owner(workspace_id));

grant select, insert, update, delete on public.weibo_connections, public.weibo_device_authorizations to authenticated;

alter table public.mirror_drafts drop constraint if exists mirror_drafts_status_check;
alter table public.mirror_drafts add constraint mirror_drafts_status_check check (
  status in ('draft', 'needs_review', 'approved', 'scheduled', 'publishing', 'published',
             'failed', 'handoff_pending', 'reported_published', 'skipped')
);
alter table public.mirror_drafts
  add column if not exists approved_at timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists publishing_started_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists platform_post_id text,
  add column if not exists publish_attempts integer not null default 0 check (publish_attempts between 0 and 10),
  add column if not exists last_error text,
  add column if not exists ai_generated boolean not null default false,
  add column if not exists schedule_batch_id uuid;

create index if not exists mirror_drafts_due_idx
  on public.mirror_drafts (scheduled_at, status)
  where status in ('scheduled', 'failed');

-- 初审页一次确认整批排期。每条内容必须显式给出未来 30 天内的时间。
create or replace function public.schedule_weibo_drafts(input_items jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  current_workspace uuid;
  item jsonb;
  item_id uuid;
  item_time timestamptz;
  batch_id uuid := gen_random_uuid();
  affected integer := 0;
begin
  select id into current_workspace from public.workspaces where owner_id = (select auth.uid());
  if current_workspace is null then raise exception '没有可编辑的工作空间'; end if;
  if jsonb_typeof(input_items) <> 'array' or jsonb_array_length(input_items) < 1 or jsonb_array_length(input_items) > 20 then
    raise exception '一次请选择 1～20 条草稿';
  end if;

  for item in select value from jsonb_array_elements(input_items) loop
    begin
      item_id := (item->>'id')::uuid;
      item_time := (item->>'scheduled_at')::timestamptz;
    exception when others then
      raise exception '排期数据格式无效';
    end;
    if item_time < now() + interval '2 minutes' or item_time > now() + interval '30 days' then
      raise exception '发布时间须在 2 分钟后至 30 天内';
    end if;
    update public.mirror_drafts
      set status = 'scheduled', approved_at = now(), scheduled_at = item_time,
          schedule_batch_id = batch_id, last_error = null, updated_at = now()
      where id = item_id and workspace_id = current_workspace
        and target_platform = 'weibo'
        and status in ('draft', 'needs_review', 'approved', 'failed');
    if not found then raise exception '有草稿状态已变化，请刷新后重试'; end if;
    affected := affected + 1;
  end loop;
  return affected;
end;
$$;
revoke all on function public.schedule_weibo_drafts(jsonb) from public, anon;
grant execute on function public.schedule_weibo_drafts(jsonb) to authenticated;

-- 自动抓取任务读取连接；返回的仍是密文，只能由持有服务器密钥的应用解密。
create or replace function public.automation_get_x_connection(input_secret text)
returns table (
  workspace_id uuid, token_ciphertext text, x_user_id text,
  last_post_id text, last_synced_at timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  if not public.automation_secret_valid(input_secret) then raise exception 'unauthorized'; end if;
  return query
    select c.workspace_id, c.token_ciphertext, c.x_user_id, c.last_post_id, c.last_synced_at
    from public.x_read_connections c
    order by c.updated_at desc limit 1;
end;
$$;
revoke all on function public.automation_get_x_connection(text) from public, authenticated;
grant execute on function public.automation_get_x_connection(text) to anon;

create or replace function public.automation_save_x_posts(
  input_secret text, input_workspace_id uuid, input_user_id text,
  input_newest_id text, input_posts jsonb
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  current_source uuid;
  imported integer := 0;
  post_body text;
  post_id text;
begin
  if not public.automation_secret_valid(input_secret) then raise exception 'unauthorized'; end if;
  if jsonb_typeof(input_posts) <> 'array' or jsonb_array_length(input_posts) > 100 then raise exception 'invalid posts'; end if;
  if not exists (select 1 from public.x_read_connections where workspace_id = input_workspace_id) then raise exception 'invalid workspace'; end if;

  for item in select value from jsonb_array_elements(input_posts) loop
    post_id := item->>'id';
    post_body := item->>'body';
    if post_id !~ '^[0-9]{1,19}$' or post_body is null or length(post_body) < 1 or length(post_body) > 20000 then
      raise exception 'invalid post';
    end if;
    insert into public.content_sources
      (workspace_id, origin_platform, external_id, source_url, ownership, content_type, published_at, updated_at)
    values
      (input_workspace_id, 'x', post_id,
       'https://x.com/Global_Funny_/status/' || post_id, 'mine', 'text',
       nullif(item->>'created_at', '')::timestamptz, now())
    on conflict (workspace_id, origin_platform, external_id) do update set
      source_url = excluded.source_url, published_at = excluded.published_at, updated_at = now()
    returning id into current_source;

    insert into public.content_revisions (workspace_id, source_id, body, content_hash, media)
    values (
      input_workspace_id, current_source, post_body,
      encode(extensions.digest(post_body, 'sha256'), 'hex'),
      coalesce(item->'media', '[]'::jsonb)
    ) on conflict (source_id, content_hash) do nothing;
    imported := imported + 1;
  end loop;

  update public.x_read_connections set
    x_user_id = input_user_id,
    last_post_id = coalesce(input_newest_id, last_post_id),
    last_synced_at = now(), updated_at = now()
  where workspace_id = input_workspace_id;
  return imported;
end;
$$;
revoke all on function public.automation_save_x_posts(text, uuid, text, text, jsonb) from public, authenticated;
grant execute on function public.automation_save_x_posts(text, uuid, text, text, jsonb) to anon;

-- 每次只抢占一条到期草稿，FOR UPDATE SKIP LOCKED 防止并发与重复发布。
create or replace function public.automation_claim_due_weibo(input_secret text)
returns table (
  draft_id uuid, workspace_id uuid, body text, ai_generated boolean,
  target_account_id text, access_token_ciphertext text, refresh_token_ciphertext text,
  access_expires_at timestamptz, refresh_expires_at timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  if not public.automation_secret_valid(input_secret) then raise exception 'unauthorized'; end if;
  return query
  with candidate as (
    select d.id
    from public.mirror_drafts d
    join public.weibo_connections c on c.workspace_id = d.workspace_id and c.status = 'active'
    where d.status in ('scheduled', 'failed')
      and d.scheduled_at <= now()
      and d.publish_attempts < 3
    order by d.scheduled_at asc
    for update of d skip locked
    limit 1
  ), claimed as (
    update public.mirror_drafts d set
      status = 'publishing', publishing_started_at = now(),
      publish_attempts = d.publish_attempts + 1, updated_at = now()
    from candidate where d.id = candidate.id
    returning d.*
  )
  select d.id, d.workspace_id, d.body, d.ai_generated, d.target_account_id,
         c.access_token_ciphertext, c.refresh_token_ciphertext,
         c.access_expires_at, c.refresh_expires_at
  from claimed d join public.weibo_connections c on c.workspace_id = d.workspace_id;
end;
$$;
revoke all on function public.automation_claim_due_weibo(text) from public, authenticated;
grant execute on function public.automation_claim_due_weibo(text) to anon;

create or replace function public.automation_update_weibo_tokens(
  input_secret text, input_workspace_id uuid, input_access_ciphertext text,
  input_refresh_ciphertext text, input_access_expires_at timestamptz,
  input_refresh_expires_at timestamptz
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.automation_secret_valid(input_secret) then raise exception 'unauthorized'; end if;
  update public.weibo_connections set
    access_token_ciphertext = input_access_ciphertext,
    refresh_token_ciphertext = input_refresh_ciphertext,
    access_expires_at = input_access_expires_at,
    refresh_expires_at = input_refresh_expires_at,
    status = 'active', last_verified_at = now(), updated_at = now()
  where workspace_id = input_workspace_id;
end;
$$;
revoke all on function public.automation_update_weibo_tokens(text, uuid, text, text, timestamptz, timestamptz) from public, authenticated;
grant execute on function public.automation_update_weibo_tokens(text, uuid, text, text, timestamptz, timestamptz) to anon;

create or replace function public.automation_finish_weibo_publish(
  input_secret text, input_draft_id uuid, input_success boolean,
  input_post_id text, input_published_url text, input_error text, input_retryable boolean
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.automation_secret_valid(input_secret) then raise exception 'unauthorized'; end if;
  update public.mirror_drafts set
    status = case
      when input_success then 'published'
      when input_retryable and publish_attempts < 3 then 'failed'
      else 'needs_review'
    end,
    platform_post_id = case when input_success then input_post_id else platform_post_id end,
    published_url = case when input_success then input_published_url else published_url end,
    published_at = case when input_success then now() else published_at end,
    confirmed_at = case when input_success then now() else confirmed_at end,
    last_error = case when input_success then null else left(coalesce(input_error, '发布失败'), 500) end,
    scheduled_at = case
      when input_success then scheduled_at
      when input_retryable and publish_attempts < 3 then now() + interval '15 minutes'
      else scheduled_at
    end,
    updated_at = now()
  where id = input_draft_id and status = 'publishing';
end;
$$;
revoke all on function public.automation_finish_weibo_publish(text, uuid, boolean, text, text, text, boolean) from public, authenticated;
grant execute on function public.automation_finish_weibo_publish(text, uuid, boolean, text, text, text, boolean) to anon;
