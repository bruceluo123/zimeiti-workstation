-- Only newly discovered, text-only X posts are queued for immediate Weibo publishing.
-- Existing review drafts and historical imports keep their current state.
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
  previous_post_id text;
  weibo_account_id text;
  newly_discovered boolean;
  auto_publish boolean;
begin
  if not public.automation_secret_valid(input_secret) then raise exception 'unauthorized'; end if;
  if jsonb_typeof(input_posts) <> 'array' or jsonb_array_length(input_posts) > 100 then raise exception 'invalid posts'; end if;

  select last_post_id into previous_post_id
  from public.x_read_connections where workspace_id = input_workspace_id for update;
  if not found then raise exception 'invalid workspace'; end if;
  select weibo_user_id into weibo_account_id
  from public.weibo_connections
  where workspace_id = input_workspace_id and status = 'active' and refresh_expires_at > now();

  for item in select value from jsonb_array_elements(input_posts) loop
    post_id := item->>'id';
    post_body := item->>'body';
    if post_id !~ '^[0-9]{1,19}$' or post_body is null or length(post_body) < 1 or length(post_body) > 20000 then
      raise exception 'invalid post';
    end if;

    current_source := null;
    insert into public.content_sources
      (workspace_id, origin_platform, external_id, source_url, ownership, content_type, published_at, updated_at)
    values
      (input_workspace_id, 'x', post_id,
       'https://x.com/Global_Funny_/status/' || post_id, 'mine', 'text',
       nullif(item->>'created_at', '')::timestamptz, now())
    on conflict (workspace_id, origin_platform, external_id) do nothing
    returning id into current_source;
    newly_discovered := current_source is not null;
    if not newly_discovered then
      update public.content_sources set
        source_url = 'https://x.com/Global_Funny_/status/' || post_id,
        published_at = nullif(item->>'created_at', '')::timestamptz,
        updated_at = now()
      where workspace_id = input_workspace_id and origin_platform = 'x' and external_id = post_id
      returning id into current_source;
    end if;

    insert into public.content_revisions (workspace_id, source_id, body, content_hash, media)
    values (
      input_workspace_id, current_source, post_body,
      encode(extensions.digest(post_body, 'sha256'), 'hex'),
      coalesce(item->'media', '[]'::jsonb)
    ) on conflict (source_id, content_hash) do update set body = excluded.body
    returning id into current_revision;

    auto_publish := newly_discovered and previous_post_id is not null
      and weibo_account_id is not null
      and jsonb_typeof(coalesce(item->'media', '[]'::jsonb)) = 'array'
      and jsonb_array_length(coalesce(item->'media', '[]'::jsonb)) = 0;
    insert into public.mirror_drafts
      (workspace_id, source_id, revision_id, target_platform, target_account_id,
       body, status, approved_at, scheduled_at)
    values
      (input_workspace_id, current_source, current_revision, 'weibo',
       coalesce(weibo_account_id, '7331277089'), post_body,
       case when auto_publish then 'scheduled' else 'needs_review' end,
       case when auto_publish then now() else null end,
       case when auto_publish then now() else null end)
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
