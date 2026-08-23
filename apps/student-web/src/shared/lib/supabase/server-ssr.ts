import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@altitutor/shared';
import { instrumentSupabaseClient } from '@/lib/sentry/instrument-supabase-client';

/**
 * Create a Supabase client for use in Server Components and API Routes
 * Uses @supabase/ssr for better TypeScript support
 */
export function createClient() {
  // Skip validation during build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    // Return a dummy client during build to avoid errors
    return instrumentSupabaseClient(createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
      {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      }
    ));
  }

  const cookieStore = cookies();

  return instrumentSupabaseClient(createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      cookieOptions: {
        name: 'student-auth',
      },
    }
  ));
}
