-- 在专用测试库执行；所有伪用户与内容均在事务结束时回滚。
begin;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'maimanfen-a@example.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'maimanfen-b@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$
declare
  first_draft uuid;
  repeat_draft uuid;
  original_body text := E'第一行\n第二行😊';
begin
  if (select count(*) from public.workspaces) <> 1 then
    raise exception 'RLS leaked another user workspace';
  end if;
  first_draft := public.save_manual_original(original_body, 'https://x.com/Global_Funny_/status/123', '123', '7331277089');
  repeat_draft := public.save_manual_original(original_body, 'https://x.com/Global_Funny_/status/123', '123', '7331277089');
  if first_draft is distinct from repeat_draft then raise exception 'duplicate URL produced another draft'; end if;
  if (select body from public.mirror_drafts where id = first_draft) is distinct from original_body then
    raise exception 'mirror body changed whitespace or emoji';
  end if;
  if (select count(*) from public.content_sources) <> 1 then
    raise exception 'duplicate URL produced another source';
  end if;
  insert into public.video_briefs (workspace_id, source_id, revision_id, title, script, review_notes)
  select draft.workspace_id, draft.source_id, draft.revision_id,
    '测试拍摄稿', E'第一行\n第二行😊', '核对个人经历'
  from public.mirror_drafts draft where draft.id = first_draft;
  if (select count(*) from public.video_briefs) <> 1 then
    raise exception 'owner could not save a video brief';
  end if;
  insert into public.legacy_items (workspace_id, kind, legacy_id, origin, content_hash, payload)
  select id, 'thought', 'thought-1', 'browser', 'test-hash', '{"id":"thought-1","content":"旧想法"}'::jsonb
  from public.workspaces where owner_id = auth.uid();
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
do $$
begin
  if (select count(*) from public.content_sources) <> 0 then
    raise exception 'user B can read user A sources';
  end if;
  if (select count(*) from public.mirror_drafts) <> 0 then
    raise exception 'user B can read user A drafts';
  end if;
  if (select count(*) from public.legacy_items) <> 0 then
    raise exception 'user B can read user A legacy backups';
  end if;
  if (select count(*) from public.video_briefs) <> 0 then
    raise exception 'user B can read user A video briefs';
  end if;
end $$;
rollback;
