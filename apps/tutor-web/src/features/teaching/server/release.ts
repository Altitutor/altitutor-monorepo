import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

/** Deployment identity and bounded dependency readiness; never returns user data. */
export async function teachingRelease(): Promise<Response> {
  const sha = process.env.TEACHING_RELEASE_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
  const known = typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let ready = false;
  if (known && url && anonKey && serviceKey) {
    try {
      const client = createClient<Database>(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      // System readiness only: the scoped-view query requests zero records.
      const [database, auth] = await Promise.all([
        client.from('vtutor_profile').select('id').limit(0).abortSignal(AbortSignal.timeout(3000)),
        fetch(new URL('/auth/v1/settings', url), {
          headers: { apikey: anonKey }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(3000),
        }),
      ]);
      ready = !database.error && auth.ok;
    } catch { /* Readiness fails closed without exposing configuration or diagnostics. */ }
  }
  return Response.json({ sha: known ? sha : null, contract: 1, ready }, {
    status: known && ready ? 200 : 503,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
