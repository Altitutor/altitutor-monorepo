import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

/**
 * Get Supabase client with service role privileges
 * 
 * IMPORTANT: This client bypasses RLS and should ONLY be used server-side
 * in API routes with proper authorization checks.
 * 
 * NEVER expose this client or the service role key to the client-side.
 * 
 * Note: SUPABASE_SERVICE_ROLE_KEY is automatically derived from SUPABASE_SECRET_KEY
 * by the deployment scripts for backward compatibility.
 */
export function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRole) {
    throw new Error(
      'Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

