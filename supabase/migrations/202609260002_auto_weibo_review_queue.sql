-- 新抓取的本人 X 原创直接进入微博初审，不需要再手工点一次“生成草稿”。
-- 只进入 needs_review，绝不会自动排期或发布。

create or replace function public.automation_save_x_posts(
  input_secret text, input_workspace_id uuid, input_user_id text,
  input_newest_id text, input_posts jsonb
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  current_source uuid;
  current_revision uuid;
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
    ) on conflict (source_id, content_hash) do update set body = excluded.body
    returning id into current_revision;

    insert into public.mirror_drafts
      (workspace_id, source_id, revision_id, target_platform, target_account_id, body, status)
    values
      (input_workspace_id, current_source, current_revision, 'weibo', '7331277089', post_body, 'needs_review')
    on conflict (workspace_id, source_id, target_platform, target_account_id, intent_generation)
    do update set revision_id = excluded.revision_id, body = excluded.body, updated_at = now()
    where public.mirror_drafts.status in ('draft', 'needs_review')
      and not public.mirror_drafts.manually_edited;
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

-- 一次性把已经抓取但尚无微博草稿的本人 X 原创补到初审队列。
insert into public.mirror_drafts
  (workspace_id, source_id, revision_id, target_platform, target_account_id, body, status)
select source.workspace_id, source.id, revision.id, 'weibo', '7331277089', revision.body, 'needs_review'
from public.content_sources source
join lateral (
  select r.id, r.body from public.content_revisions r
  where r.source_id = source.id and r.workspace_id = source.workspace_id
  order by r.created_at desc limit 1
) revision on true
where source.origin_platform = 'x' and source.ownership = 'mine'
on conflict (workspace_id, source_id, target_platform, target_account_id, intent_generation) do nothing;
