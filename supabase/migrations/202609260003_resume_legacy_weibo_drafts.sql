-- 旧版“复制后等待手工发布”的未完成内容回到新的初审队列。
update public.mirror_drafts
set status = 'needs_review', confirmed_at = null, updated_at = now()
where status = 'handoff_pending' and published_url is null;
