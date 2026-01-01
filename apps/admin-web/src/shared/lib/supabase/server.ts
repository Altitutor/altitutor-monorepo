import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

// Environment variable validation - only check at runtime, not during build
function validateEnvVars() {
  // Skip validation during build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
}

/**
 * Server-only Supabase client for API routes and server components
 * Creates a fresh client on each call (safe for concurrent requests)
 * 
 * ✅ Use in: API routes, Server Components, Server Actions
 * ❌ Don't use in: Client Components, browser code
 */
export function getServerSupabaseClient() {
  validateEnvVars();
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,  // Server doesn't need session persistence
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

/**
 * Admin client with service role key (full access)
 * Use ONLY in secure API routes, never in client code
 * 
 * Note: SUPABASE_SERVICE_ROLE_KEY is automatically derived from SUPABASE_SECRET_KEY
 * by the deployment scripts for backward compatibility.
 * Supports both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SECRET_KEY for flexibility.
 */
export function getServerSupabaseAdmin() {
  // Support both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SECRET_KEY for backward compatibility
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  
  // Skip validation during build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    // Return a dummy client during build to avoid errors
    return createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      serviceRoleKey || 'placeholder-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  
  if (!serviceRoleKey) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  }

  validateEnvVars();

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

