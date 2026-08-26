import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@altitutor/shared";
import { instrumentSupabaseClient } from "@/lib/sentry/instrument-supabase-client";

export async function createServerComponentClient(globalFetch?: typeof fetch) {
  const cookieStore = await cookies();

  return instrumentSupabaseClient(
    createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch {
              // Middleware owns session refresh response cookies.
            }
          },
        },
        cookieOptions: { name: "student-auth" },
        ...(globalFetch ? { global: { fetch: globalFetch } } : {}),
      },
    ),
  );
}
