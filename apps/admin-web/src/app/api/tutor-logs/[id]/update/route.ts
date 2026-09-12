import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createUserClient } from '@/shared/lib/supabase/server-ssr';
import type { Database } from '@altitutor/shared';
import {
  CHECK_IN_LOG_FORBIDDEN_MESSAGE,
  staffMaySubmitTutorLog,
} from '@altitutor/shared/pay-tiers';
import type { TutorLogFormData } from '@/features/tutor-logs/types';

type TutorLogUpdateResult = {
  success?: boolean;
  error?: string;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userClient = createUserClient();
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [{ data: isAdmin, error: adminError }, { data: actorStaffId, error: actorError }] =
      await Promise.all([
        userClient.rpc('is_adminstaff_active'),
        userClient.rpc('current_staff_id'),
      ]);

    if (adminError || !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    if (actorError || !actorStaffId) {
      return NextResponse.json(
        { error: 'Failed to resolve the authenticated admin staff member' },
        { status: 500 }
      );
    }

    const { id: tutorLogId } = await params;
    const body = await request.json();
    const { data, loggedForStaffId } = body as {
      data: TutorLogFormData;
      loggedForStaffId: string;
    };

    if (!tutorLogId) {
      return NextResponse.json({ error: 'Tutor log ID is required' }, { status: 400 });
    }
    if (!data?.sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    if (!loggedForStaffId) {
      return NextResponse.json(
        { error: 'loggedForStaffId is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createServiceClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingLog, error: fetchError } = await supabase
      .from('tutor_logs')
      .select('session_id, session:sessions!inner(type)')
      .eq('id', tutorLogId)
      .maybeSingle();

    if (fetchError) {
      captureApiError(fetchError, '/api/tutor-logs/[id]/update');
      return NextResponse.json({ error: 'Failed to load tutor log' }, { status: 500 });
    }
    if (!existingLog) {
      return NextResponse.json({ error: 'Tutor log not found' }, { status: 404 });
    }
    if (data.sessionId !== existingLog.session_id) {
      return NextResponse.json(
        { error: 'Tutor log session cannot be changed' },
        { status: 400 }
      );
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from('sessions_staff')
      .select('type')
      .eq('session_id', existingLog.session_id)
      .eq('staff_id', loggedForStaffId)
      .maybeSingle();

    if (assignmentError) {
      captureApiError(assignmentError, '/api/tutor-logs/[id]/update');
      return NextResponse.json({ error: 'Failed to verify staff assignment' }, { status: 500 });
    }
    if (!assignment) {
      return NextResponse.json(
        { error: 'The staff member logged for must be assigned to the session' },
        { status: 400 }
      );
    }
    if (!staffMaySubmitTutorLog(existingLog.session.type, assignment.type)) {
      return NextResponse.json({ error: CHECK_IN_LOG_FORBIDDEN_MESSAGE }, { status: 403 });
    }

    const rpcParams = {
      p_tutor_log_id: tutorLogId,
      p_updated_by: actorStaffId,
      p_logged_for_staff_id: loggedForStaffId,
      p_staff_attendance: (data.staffAttendance || []).map((row) => ({
        staffId: row.staffId,
        attended: row.attended,
        type: row.type,
      })),
      p_student_attendance: (data.studentAttendance || []).map((row) => ({
        studentId: row.studentId,
        attended: row.attended,
      })),
      p_parent_attendance: (data.parentAttendance || []).map((row) => ({
        parentId: row.parentId,
        attended: row.attended,
      })),
      p_topics: (data.topics || []).map((row) => ({
        topicId: row.topicId,
        studentIds: row.studentIds || [],
      })),
      p_topic_files: (data.topicFiles || []).map((row) => ({
        topicsFilesId: row.topicsFilesId,
        topicId: row.topicId,
        studentIds: row.studentIds || [],
      })),
    };

    const { data: result, error } = await supabase.rpc('update_tutor_log', rpcParams);
    if (error) {
      captureApiError(error, '/api/tutor-logs/[id]/update');
      return NextResponse.json(
        { error: error.message || 'Failed to update tutor log' },
        { status: 500 }
      );
    }

    const updateResult = result as TutorLogUpdateResult | null;
    if (!updateResult?.success) {
      return NextResponse.json(
        { error: updateResult?.error || 'Failed to update tutor log' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureApiError(error, '/api/tutor-logs/[id]/update');
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
