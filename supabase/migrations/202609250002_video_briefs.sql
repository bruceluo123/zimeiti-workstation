-- 每份拍摄稿绑定一条本人原创的明确版本。旧稿不随原文后续编辑而静默改变。
create table public.video_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_id uuid not null references public.content_sources(id) on delete cascade,
  revision_id uuid not null,
  title text not null check (char_length(title) between 1 and 180),
  script text not null check (char_length(script) between 1 and 20000),
  shooting_notes text not null default '',
  review_notes text not null default '',
  status text not null default 'draft' check (status in ('draft', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source_id, revision_id),
  foreign key (revision_id, workspace_id, source_id)
    references public.content_revisions (id, workspace_id, source_id)
);

create index video_briefs_recent_idx on public.video_briefs (workspace_id, created_at desc);

alter table public.video_briefs enable row level security;
create policy video_briefs_select on public.video_briefs for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy video_briefs_insert on public.video_briefs for insert to authenticated
  with check (
    private.can_edit_workspace(workspace_id)
    and exists (
      select 1 from public.content_sources source
      where source.id = source_id and source.workspace_id = workspace_id and source.ownership = 'mine'
    )
  );
create policy video_briefs_update on public.video_briefs for update to authenticated
  using (private.can_edit_workspace(workspace_id))
  with check (private.can_edit_workspace(workspace_id));

grant select, insert, update on public.video_briefs to authenticated;
