import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

import { instrumentSupabaseClient } from '@/lib/sentry/instrument-supabase-client';
import { createClient as createServerClient } from '@/shared/lib/supabase/server-ssr';

export function createNotificationUserClient(request: Request): SupabaseClient<Database> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return createServerClient() as SupabaseClient<Database>;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase configuration');
  return instrumentSupabaseClient(
    createClient<Database>(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  );
}
