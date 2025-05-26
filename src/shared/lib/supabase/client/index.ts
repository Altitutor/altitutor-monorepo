import { createClient } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '../database/types';

// Environment variable validation
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Server-side client for server components and API routes
export const supabaseServer = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Admin client with service role for admin operations
// This should only be used server-side in secure API routes
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : null;

/**
 * Get the appropriate Supabase client based on environment
 * - Browser: Returns client component client with cookie handling
 * - Server: Returns server client
 */
export function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    return createClientComponentClient<Database>();
  }
  return supabaseServer;
}

/**
 * Hook for React components to get a properly configured client
 * This function can be called during SSR but will return the appropriate client
 */
export function useSupabaseClient() {
  // During SSR or server context, return the server client
  // During client hydration/runtime, return the client component client
  if (typeof window === 'undefined') {
    return supabaseServer;
  }
  return createClientComponentClient<Database>();
} 