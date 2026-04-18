import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";

/**
 * Server-only Supabase client using the service role key.
 *
 * This bypasses RLS and must only be used for trusted backend operations.
 * Never import this into client components.
 */
export const supabaseAdmin = (() => {
  if (typeof window !== "undefined") return null;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
})();
