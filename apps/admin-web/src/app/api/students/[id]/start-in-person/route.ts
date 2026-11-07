import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { captureApiError } from '@/lib/sentry/capture-api-error';

export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: journeyId, error } = await supabase.rpc('start_student_in_person_onboarding', { p_student_id: id });
    if (!error) return NextResponse.json({ journeyId });
    if (error.code === '42501') return NextResponse.json({ error: 'Active AdminStaff access required' }, { status: 403 });
    if (error.code === 'P0002') return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    if (error.code === '22P02') return NextResponse.json({ error: 'Invalid Student ID' }, { status: 400 });
    if (error.code === 'P0001' && error.message === 'In-person onboarding is only available before registration') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    captureApiError(error, '/api/students/[id]/start-in-person');
  } catch (error) {
    captureApiError(error, '/api/students/[id]/start-in-person');
  }
  return NextResponse.json({ error: 'Unable to start in-person onboarding. Please try again.' }, { status: 500 });
}
