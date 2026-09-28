import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function getOwnerWorkspace() {
  const expectedEmail = process.env.ZMT_OWNER_EMAIL?.trim().toLowerCase();
  if (!isSupabaseConfigured() || !expectedEmail) return null;
  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || typeof claims.email !== "string" || claims.email.toLowerCase() !== expectedEmail) return null;
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", claims.sub)
    .single();
  if (workspaceError || !workspace) return null;
  return { supabase, workspaceId: workspace.id as string };
}
