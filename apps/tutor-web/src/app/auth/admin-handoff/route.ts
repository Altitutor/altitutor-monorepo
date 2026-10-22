import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { handoffScript } from './bridge';

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };

export function GET() {
  const adminOrigin = new URL(process.env.NEXT_PUBLIC_ADMIN_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://admin.altitutor.com' : 'http://localhost:3000')).origin;
  const script = handoffScript(adminOrigin);
  const hash = createHash('sha256').update(script).digest('base64');
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Opening your pay tier</title></head><body><p id="status">Signing in to the tutor portal…</p><script>${script}</script></body></html>`, {
    headers: {
      ...headers, 'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'sha256-${hash}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'`,
    },
  });
}

export async function POST(request: Request) {
  const tutorOrigin = new URL(process.env.NEXT_PUBLIC_TUTOR_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://tutor.altitutor.com' : 'http://localhost:3002')).origin;
  if (request.headers.get('origin') !== tutorOrigin ||
    request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  }
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || !('tokenHash' in body) ||
      typeof body.tokenHash !== 'string' || !/^[a-zA-Z0-9_-]{16,512}$/.test(body.tokenHash)) {
      return NextResponse.json({ error: 'Invalid sign-in request' }, { status: 400, headers });
    }
    const { error } = await createClient().auth.verifyOtp({ type: 'magiclink', token_hash: body.tokenHash });
    if (error) return NextResponse.json({ error: 'Sign-in failed' }, { status: 401, headers });
    return NextResponse.json({ ok: true }, { headers });
  } catch {
    return NextResponse.json({ error: 'Unable to sign in' }, { status: 503, headers });
  }
}
