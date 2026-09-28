-- Supabase 默认给 anon/authenticated 函数 EXECUTE；将 definer 辅助函数移出公开 API schema。
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke all on function public.is_workspace_member(uuid) from anon;
revoke all on function public.is_workspace_owner(uuid) from anon;
revoke all on function public.can_edit_workspace(uuid) from anon;
revoke all on function public.create_personal_workspace() from public, anon, authenticated;

alter function public.is_workspace_member(uuid) set schema private;
alter function public.is_workspace_owner(uuid) set schema private;
alter function public.can_edit_workspace(uuid) set schema private;
alter function public.create_personal_workspace() set schema private;
