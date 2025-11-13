import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
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

// Memoized browser client instance to prevent multiple instances
// Uses unique cookie name 'admin-auth' to prevent collision with other apps
let browserClientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

function getBrowserClient() {
  // Return memoized instance if it exists
  if (browserClientInstance) {
    return browserClientInstance;
  }

  // Skip validation during build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    // Return a dummy client during build
    browserClientInstance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
      {
        cookieOptions: {
          name: 'admin-auth',
        },
        isSingleton: true,
      }
    );
    return browserClientInstance;
  }
  
  validateEnvVars();
  
  // Use isSingleton: true to ensure only one instance per URL+key combination
  // This is the recommended approach for Next.js App Router
  browserClientInstance = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'admin-auth',
      },
      isSingleton: true,
    }
  );
  return browserClientInstance;
}

/**
 * Get the appropriate Supabase client based on environment
 * - Browser: Returns browser client with cookie handling (memoized, uses 'admin-auth' cookie)
 * - Server (SSR): Returns browser client (will be replaced on hydration)
 */
export function getSupabaseClient(): SupabaseClient<Database> {
    return getBrowserClient() as unknown as SupabaseClient<Database>;
}

/**
 * Hook for React components to get a properly configured client
 * Safe to call in client components during SSR - will return browser client
 * that gets properly initialized after hydration
 */
export function useSupabaseClient(): SupabaseClient<Database> {
  return getBrowserClient() as unknown as SupabaseClient<Database>;
}