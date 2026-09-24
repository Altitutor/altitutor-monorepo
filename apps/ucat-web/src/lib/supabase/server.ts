import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { instrumentSupabaseClient } from "@/lib/sentry/instrument-supabase-client";

export async function getSupabaseServerClient(globalFetch?: typeof fetch): Promise<
  SupabaseClient<Database>
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip validation during Next.js production build (CI) so prerender can complete
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return instrumentSupabaseClient(createServerClient<Database>(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseAnonKey || "placeholder-key",
      {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
        cookieOptions: {
          name: "student-auth",
        },
      },
    ) as unknown as SupabaseClient<Database>);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const cookieStore = await cookies();

  return instrumentSupabaseClient(createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components cannot always mutate cookies; middleware refreshes
        // the session. Without this guard, getUser() can fail open as !user and
        // trigger soft redirects that loop with middleware.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore — session refresh is handled in middleware.
        }
      },
    },
    cookieOptions: {
      name: "student-auth",
    },
    ...(globalFetch ? { global: { fetch: globalFetch } } : {}),
  }) as unknown as SupabaseClient<Database>);
}
