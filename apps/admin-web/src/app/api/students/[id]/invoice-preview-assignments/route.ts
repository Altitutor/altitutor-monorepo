import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { getErrorMessage } from '@/shared/utils';
import { loadPreviewableAssignmentIds } from '@/features/sessions/server/invoice-preview-assignments';

/**
 * GET /api/students/[id]/invoice-preview-assignments
 * Assignments the billing runner will invoice for this student.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const studentId = params.id;
    const supabase = createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role, status')
      .eq('user_id', session.user.id)
      .single<{ role: string; status: string }>();

    if (staffError || !staffData || staffData.role !== 'ADMINSTAFF' || staffData.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const sessionsStudentsIds = await loadPreviewableAssignmentIds(supabaseAdmin, studentId);
    return NextResponse.json({ sessions_students_ids: sessionsStudentsIds });
  } catch (error: unknown) {
    captureApiError(error, '/api/students/[id]/invoice-preview-assignments');
    console.error('[api/students/invoice-preview-assignments] Error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
