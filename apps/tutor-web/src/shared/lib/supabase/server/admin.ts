import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

// Create a server-only admin client using the service role key
// Never import this from client components
export const supabaseAdmin = (() => {
  if (typeof window !== 'undefined') return null;
  
  // Support both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SECRET_KEY for backward compatibility
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !serviceRoleKey) return null;
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
})();


