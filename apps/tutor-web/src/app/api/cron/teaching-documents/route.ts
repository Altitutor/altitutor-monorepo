import * as Sentry from '@sentry/nextjs';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { expireTeachingDocuments } from '@altitutor/shared/teaching/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const deadlineAt = Date.now() + 50_000;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Cleanup configuration unavailable');
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }, db: { retry: false },
      global: { fetch: (input, init) => fetch(input, { ...init,
        signal: AbortSignal.timeout(Math.max(1, Math.min(10000, deadlineAt - Date.now()))),
      }) },
    });
    const result = await expireTeachingDocuments(client, { deadlineAt, onFailure: () => {
      Sentry.captureMessage('Teaching PDF cleanup will retry', { level: 'error', fingerprint: ['teaching-pdf-cleanup-retry'] });
    } });
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    Sentry.captureMessage('Teaching PDF cleanup unavailable', { level: 'error', fingerprint: ['teaching-pdf-cleanup-unavailable'] });
    return Response.json({ error: 'Cleanup will retry.' }, { status: 503 });
  }
}
