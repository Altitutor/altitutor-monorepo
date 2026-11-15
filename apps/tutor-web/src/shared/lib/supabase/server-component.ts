import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { DependencyEvidence, Database } from "@altitutor/shared";
import { instrumentSupabaseClient } from "@/lib/sentry/instrument-supabase-client";

export async function createServerComponentClient(globalFetch?: typeof fetch, evidence?: DependencyEvidence) {
  const cookieStore = await cookies();
  if (evidence) {
    try { evidence.invocation((await headers()).get("x-vercel-id")); } catch { /* Optional correlation only. */ }
  }

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
        cookieOptions: { name: process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME || "tutor-auth" },
        ...(globalFetch ? { global: { fetch: globalFetch } } : {}),
      },
    ),
  );
}
