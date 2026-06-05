function readSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appPassword = process.env.APP_PASSWORD;
  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!appPassword) missing.push("APP_PASSWORD");
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(
        ", ",
      )}. Update .env.local with values from your Supabase project and pick a single-user password.`,
    );
  }
  return {
    url: url!,
    anonKey: anonKey!,
    serviceRoleKey: serviceRoleKey!,
    appPassword: appPassword!,
  };
}

export const ENV = readSupabaseEnv();

export const SINGLE_USER_ID = "00000000-0000-0000-0000-000000000001";

export const AUTH_COOKIE = "app_auth";
