import { createClient } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';

// Environment variable validation - only check at runtime, not during build
function validateEnvVars() {
  if (typeof window === 'undefined') {
    // Server-side: only validate if we're actually running (not during build)
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return; // Skip validation during build
    }
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
}

// Create a server client on demand (never in the browser) to avoid duplicate GoTrue instances
function createServerClient() {
  validateEnvVars();
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}

// Server-only admin client has been moved to src/shared/lib/supabase/server/admin.ts

// Memoized browser client to avoid multiple GoTrueClient instances
// Use globalThis to persist across Fast Refresh/HMR boundaries
const globalForSupabase = globalThis as unknown as {
  __supabaseClient?: ReturnType<typeof createClientComponentClient<Database>>;
};

function getBrowserClient() {
  // Skip validation during build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    // Return a dummy client during build
    return createClientComponentClient<Database>();
  }
  
  if (!globalForSupabase.__supabaseClient) {
    globalForSupabase.__supabaseClient = createClientComponentClient<Database>();
  }
  return globalForSupabase.__supabaseClient;
}

/**
 * Get the appropriate Supabase client based on environment
 * - Browser: Returns client component client with cookie handling (memoized)
 * - Server: Returns server client
 */
export function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    return getBrowserClient();
  }
  // Server-side: create a fresh client per call (safe for SSR)
  return createServerClient();
}

/**
 * Hook for React components to get a properly configured client
 * This function can be called during SSR but will return the appropriate client
 */
export function useSupabaseClient() {
  // During SSR or server context, return a server client instance
  // During client hydration/runtime, return the memoized client
  if (typeof window === 'undefined') {
    return createServerClient();
  }
  return getBrowserClient();
}