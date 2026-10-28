import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../supabase/generated';

type Configuration = { url?: string; anonKey?: string; serviceKey?: string };

function reply(body: object, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

/** Proves the retained identity with GoTrue itself; released handles are never proof. */
export async function recoverStudentLogin(request: Request, config: Configuration) {
  const denied = () => reply({ error: 'Incorrect email or password.' }, 401);
  if (!config.url || !config.anonKey || !config.serviceKey) return reply({ error: 'Sign-in is temporarily unavailable.' }, 503);
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== 'object' || body === null || !('email' in body) || !('password' in body) ||
    typeof body.email !== 'string' || typeof body.password !== 'string') return denied();
  const email = body.email.trim().toLowerCase();
  if (!email.includes('@') || email.length > 320 || !body.password || body.password.length > 4096) return denied();
  const address = (request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown').split(',')[0]?.trim() || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address));
  const clientKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient<Database>(config.url, config.serviceKey, options);
  const { data, error } = await admin.rpc('student_retired_login_candidates', { p_email: email, p_client_key: clientKey });
  if (error) return error.message.includes('student_login_recovery_rate_limited')
    ? reply({ error: 'Too many attempts. Please try again shortly.' }, 429)
    : reply({ error: 'Sign-in is temporarily unavailable.' }, 503);
  // More matches than this bounded verification budget cannot prove one identity.
  if (!data || data.length > 10) return denied();
  const verified: Array<{ client: ReturnType<typeof createClient<Database>>; session: { access_token: string; refresh_token: string } }> = [];
  let unavailable = false;
  for (const candidate of data) {
    const client = createClient<Database>(config.url, config.anonKey, options);
    const result = await client.auth.signInWithPassword({ email: candidate.login_email, password: body.password });
    if (!result.error && result.data.user.id === candidate.auth_user_id && result.data.session) {
      verified.push({ client, session: result.data.session });
    }
    if (result.error && result.error.code !== 'invalid_credentials') { unavailable = true; break; }
  }
  if (!unavailable && verified.length === 1) {
    const session = verified[0].session;
    return reply({ access_token: session.access_token, refresh_token: session.refresh_token }, 200);
  }
  await Promise.all(verified.map(({ client }) => client.auth.signOut({ scope: 'local' })));
  if (unavailable) return reply({ error: 'Sign-in is temporarily unavailable.' }, 503);
  return denied();
}
