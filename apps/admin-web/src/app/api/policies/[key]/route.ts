import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const staffRole = (staff as { role?: string } | null)?.role;
  if (staffError || !staff || staffRole !== 'ADMINSTAFF') {
    return { error: NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 }) };
  }

  if (!supabaseAdmin) {
    return { error: NextResponse.json({ error: 'Server configuration error' }, { status: 500 }) };
  }

  return { supabase: supabaseAdmin };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { key: string } }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { supabase } = auth;
  const key = params.key;

  const { data, error } = await supabase
    .from('policies')
    .select('id, key, content, updated_at')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.error('[policies] GET error:', error);
    return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { supabase } = auth;
  const key = params.key;
  const body = await request.json();
  const { content } = body;

  if (content === undefined) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('policies')
    .update({ content })
    .eq('key', key)
    .select()
    .single();

  if (error) {
    console.error('[policies] PUT error:', error);
    return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  }

  return NextResponse.json(data);
}
