import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip validation during Next.js production build (CI) so prerender can complete
  if (process.env.NEXT_PHASE === "phase-production-build") {
    browserClient = createBrowserClient<Database>(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseAnonKey || "placeholder-key",
      {
        cookieOptions: {
          name: "student-auth",
        },
        isSingleton: true,
      },
    ) as unknown as SupabaseClient<Database>;
    return browserClient;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      name: "student-auth",
    },
    isSingleton: true,
  }) as unknown as SupabaseClient<Database>;

  return browserClient;
}
