import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

export function createAutomationSupabase() {
  const { url, key } = supabaseConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
