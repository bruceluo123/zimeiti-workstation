-- 直接客户端更新也不能把参考素材冒充本人原创。
drop policy video_briefs_update on public.video_briefs;
create policy video_briefs_update on public.video_briefs for update to authenticated
  using (private.can_edit_workspace(workspace_id))
  with check (
    private.can_edit_workspace(workspace_id)
    and exists (
      select 1 from public.content_sources source
      where source.id = source_id and source.workspace_id = workspace_id and source.ownership = 'mine'
    )
  );
