import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

export class TeachingError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function teachingClient(token?: string): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new TeachingError(503, 'Teaching services are not configured.');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }),
    },
  });
}

export async function authenticateTeaching(request: Request) {
  const match = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '');
  if (!match) throw new TeachingError(401, 'Sign in to the teaching app.');
  const client = teachingClient(match[1]);
  const { data, error } = await client.auth.getUser(match[1]);
  if (error || !data.user) {
    const unavailable = error && ((error.status ?? 0) >= 500 || error.name === 'AuthRetryableFetchError');
    if (unavailable) console.error('Teaching authentication unavailable', { code: error.code ?? error.name, status: error.status });
    throw new TeachingError(unavailable ? 503 : 401, unavailable ? 'Sign-in verification is temporarily unavailable.' : 'Please sign in again.');
  }
  const { data: row, error: profileError } = await client.from('vtutor_profile')
    .select('id,user_id,first_name,last_name,role,status').maybeSingle();
  if (profileError) throw new TeachingError(503, 'Tutor access is temporarily unavailable.');
  if (!row?.id || row.user_id !== data.user.id || !['TUTOR', 'ADMINSTAFF'].includes(row.role ?? '') ||
      !['ACTIVE', 'TRIAL'].includes(row.status ?? '')) {
    throw new TeachingError(403, 'This account does not have tutor access.');
  }
  return { client, profile: {
    id: row.id, userID: data.user.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(' '),
    canSubmitLogs: row.status === 'ACTIVE',
  } };
}
