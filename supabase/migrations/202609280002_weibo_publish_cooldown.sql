-- Spread overdue and newly mirrored posts out so a backlog is never sent in a burst.
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
    join public.weibo_connections c on c.workspace_id = d.workspace_id
      and c.weibo_user_id = d.target_account_id and c.status = 'active'
    where d.status in ('scheduled', 'failed')
      and d.scheduled_at <= now()
      and d.publish_attempts < 3
      and not exists (
        select 1 from public.mirror_drafts recent
        where recent.workspace_id = d.workspace_id
          and recent.target_platform = 'weibo'
          and recent.target_account_id = d.target_account_id
          and recent.publishing_started_at > now() - interval '30 minutes'
      )
    order by d.scheduled_at asc
    for update of d, c skip locked
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
  from claimed d join public.weibo_connections c on c.workspace_id = d.workspace_id
    and c.weibo_user_id = d.target_account_id;
end;
$$;
revoke all on function public.automation_claim_due_weibo(text) from public, authenticated;
grant execute on function public.automation_claim_due_weibo(text) to anon;
