import { createClient } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from './db/types';

// Environment variable validation
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Debug log - remove in production
console.log('Supabase URL configured:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Supabase Key available:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Server-side client for server components and API routes
export const supabaseServer = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true, // Enable session persistence
      autoRefreshToken: true, // Automatically refresh the token
      detectSessionInUrl: true // Detect token in URL for OAuth flows
    }
  }
);

// Function to get client-side instance with consistent config
export function getSupabaseClient() {
  // In browser environments, prefer the client component client which handles cookies correctly
  if (typeof window !== 'undefined') {
    return createClientComponentClient<Database>();
  }
  return supabaseServer;
}

// Hook for client components to use in React components
export function useSupabaseClient() {
  return createClientComponentClient<Database>();
} 