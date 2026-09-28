-- 将一条本人 X 原创的最新明确版本加入微博人工交接队列。
-- 正文一字不改，不调用微博发布接口。
create or replace function public.create_weibo_draft_from_source(
  input_source_id uuid,
  input_target_account_id text
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  current_workspace uuid;
  current_revision uuid;
  current_body text;
  current_draft uuid;
begin
  if input_target_account_id is null or input_target_account_id !~ '^[0-9]{5,20}$' then
    raise exception '目标微博 UID 不合法';
  end if;

  select id into current_workspace
  from public.workspaces
  where owner_id = (select auth.uid());
  if current_workspace is null then raise exception '没有可编辑的工作空间'; end if;

  select revision.id, revision.body
    into current_revision, current_body
  from public.content_sources source
  join public.content_revisions revision
    on revision.source_id = source.id and revision.workspace_id = source.workspace_id
  where source.id = input_source_id
    and source.workspace_id = current_workspace
    and source.origin_platform = 'x'
    and source.ownership = 'mine'
  order by revision.created_at desc
  limit 1;

  if current_revision is null then raise exception '找不到可交接的 X 原文'; end if;

  insert into public.mirror_drafts
    (workspace_id, source_id, revision_id, target_platform, target_account_id, body)
  values
    (current_workspace, input_source_id, current_revision, 'weibo', input_target_account_id, current_body)
  on conflict (workspace_id, source_id, target_platform, target_account_id, intent_generation)
    do update set revision_id = excluded.revision_id, body = excluded.body, updated_at = now()
    where mirror_drafts.status = 'draft' and not mirror_drafts.manually_edited
  returning id into current_draft;

  if current_draft is null then
    select id into current_draft
    from public.mirror_drafts
    where workspace_id = current_workspace
      and source_id = input_source_id
      and target_platform = 'weibo'
      and target_account_id = input_target_account_id
      and intent_generation = 0;
  end if;
  return current_draft;
end;
$$;

revoke all on function public.create_weibo_draft_from_source(uuid, text) from public, anon;
grant execute on function public.create_weibo_draft_from_source(uuid, text) to authenticated;
