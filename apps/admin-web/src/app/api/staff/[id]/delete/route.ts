import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { error } = await supabase.rpc('retire_business_record', { p_kind: 'staff', p_id: id });
    if (!error) return NextResponse.json({ success: true });
    if (error.code === '42501') return NextResponse.json({ error: 'Active AdminStaff access required' }, { status: 403 });
    if (error.code === 'P0002') return NextResponse.json({ error: 'Staff record not found' }, { status: 404 });
    if (error.code === '22P02') return NextResponse.json({ error: 'Invalid Staff ID' }, { status: 400 });
    if (error.code === 'P0001' || error.code === '55P03') return NextResponse.json({ error: error.message }, { status: 409 });
    captureApiError(error, '/api/staff/[id]/delete');
  } catch (error) { captureApiError(error, '/api/staff/[id]/delete'); }
  return NextResponse.json({ error: 'Unable to delete this Staff record. Please try again.' }, { status: 500 });
}
