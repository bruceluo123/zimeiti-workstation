-- 重复原文只复用版本。仅插入权限的版本表不应通过 ON CONFLICT UPDATE 写入。
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
  body_hash := encode(extensions.digest(normalized_body, 'sha256'), 'hex');

  insert into public.content_sources (workspace_id, origin_platform, external_id, source_url, ownership)
  values (current_workspace, 'manual', nullif(input_external_id, ''), nullif(input_source_url, ''), 'mine')
  on conflict (workspace_id, origin_platform, external_id) do update set updated_at = now()
  returning id into current_source;

  insert into public.content_revisions (workspace_id, source_id, body, content_hash)
  values (current_workspace, current_source, normalized_body, body_hash)
  on conflict (source_id, content_hash) do nothing
  returning id into current_revision;
  if current_revision is null then
    select id into current_revision from public.content_revisions
    where source_id = current_source and content_hash = body_hash;
  end if;

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
