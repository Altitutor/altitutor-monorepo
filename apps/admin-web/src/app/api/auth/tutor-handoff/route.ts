import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };

/** Only mint a sign-in for the authenticated active administrator themselves. */
export async function POST(request: Request) {
  const adminOrigin = new URL(process.env.NEXT_PUBLIC_ADMIN_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://admin.altitutor.com' : 'http://localhost:3000')).origin;
  if (request.headers.get('origin') !== adminOrigin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
  }
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    }
    const { data: staff, error: staffError } = await client.from('staff')
      .select('role, status').eq('user_id', user.id).maybeSingle();
    if (staffError || staff?.role !== 'ADMINSTAFF' || staff.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
    }
    if (!supabaseAdmin) throw new Error('Auth unavailable');
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink', email: user.email,
    });
    if (error || data?.user?.id !== user.id || !data.properties?.hashed_token) {
      throw new Error('Auth unavailable');
    }
    // No email is sent, and no caller-supplied identity or redirect is accepted.
    return NextResponse.json({ tokenHash: data.properties.hashed_token }, { headers });
  } catch {
    return NextResponse.json({ error: 'Unable to open the tutor portal' }, { status: 503, headers });
  }
}
