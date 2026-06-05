import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ENV, SINGLE_USER_ID } from "@/lib/env";

export function createAdminClient() {
  return createClient(ENV.url, ENV.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const APP_USER_ID = SINGLE_USER_ID;
