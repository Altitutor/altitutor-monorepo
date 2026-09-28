import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

import { instrumentSupabaseClient } from '@/lib/sentry/instrument-supabase-client';
import { createClient as createServerClient } from '@/shared/lib/supabase/server-ssr';

/** Resolve one authenticated StudentWeb caller without mixing cookie and bearer identities. */
export async function authenticatedFlashcardClient(request: Request): Promise<SupabaseClient<Database> | null> {
  const authorization = request.headers?.get('authorization') ?? null;
  if (authorization === null) {
    const client = createServerClient() as SupabaseClient<Database>;
    const { data, error } = await client.auth.getClaims();
    return error || !data?.claims?.sub ? null : client;
  }

  const token = authorization.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase configuration');
  const client = instrumentSupabaseClient(createClient<Database>(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }));
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user?.id || data.user.is_anonymous ? null : client;
}
