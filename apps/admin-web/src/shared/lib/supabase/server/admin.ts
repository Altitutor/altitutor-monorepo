import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

// Create a server-only admin client using the service role key
// Never import this from client components
export const supabaseAdmin = (() => {
  if (typeof window !== 'undefined') return null;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
})();


