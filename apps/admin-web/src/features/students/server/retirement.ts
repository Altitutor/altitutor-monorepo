import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { captureApiError } from '@/lib/sentry/capture-api-error';

export async function changeStudentRetirement(studentId: string, action: 'retire' | 'restore') {
  const route = `/api/students/[id]/${action === 'retire' ? 'delete' : 'restore'}`;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { error } = await supabase.rpc(action === 'retire' ? 'retire_student' : 'restore_student', { p_student_id: studentId });
    if (!error) return NextResponse.json({ success: true });
    if (error.code === '42501') return NextResponse.json({ error: 'Active AdminStaff access required' }, { status: 403 });
    if (error.code === 'P0002') return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    if (error.code === '22P02') return NextResponse.json({ error: 'Invalid Student ID' }, { status: 400 });
    if (error.code === 'P0001' && /^(Resolve (active enrolments|future bookings|subscriptions|open checkouts) before deleting this Student|This login already belongs to another Student)$/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    captureApiError(error, route);
  } catch (error) { captureApiError(error, route); }
  return NextResponse.json({ error: 'Unable to update this Student. Please try again.' }, { status: 500 });
}
