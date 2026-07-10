import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

const WORKFLOW_KEYS = ['student_unenrolment', 'student_discontinuation'] as const;
type WorkflowKey = (typeof WORKFLOW_KEYS)[number];

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('base64url');
}

export async function GET(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const studentId = new URL(request.url).searchParams.get('studentId');
  if (!studentId) return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  const admin = auth.admin as any;
  const { data: enrolments, error } = await admin
    .from('classes_students')
    .select('id, class_id, classes(id, short_name, long_name)')
    .eq('student_id', studentId)
    .is('unenrolled_at', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const classIds = (enrolments ?? []).map((row: any) => row.class_id);
  const { data: sessions } = classIds.length
    ? await admin.from('sessions').select('id, class_id, start_at, short_name, long_name').in('class_id', classIds).gte('start_at', new Date().toISOString()).order('start_at')
    : { data: [] };
  return NextResponse.json({ enrolments: enrolments ?? [], sessions: sessions ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null) as null | {
    studentId?: string;
    workflowKey?: WorkflowKey;
    enrolments?: Array<{ classesStudentsId?: string; finalSessionAt?: string; unenrolledAt?: string }>;
  };
  if (!body?.studentId || !WORKFLOW_KEYS.includes(body.workflowKey as WorkflowKey) || !body.enrolments?.length) {
    return NextResponse.json({ error: 'Student, workflow and final session dates are required.' }, { status: 400 });
  }
  if (body.enrolments.some((row) => !row.classesStudentsId || !row.finalSessionAt || !row.unenrolledAt)) {
    return NextResponse.json({ error: 'Each class needs a final session date.' }, { status: 400 });
  }

  const admin = auth.admin as any;
  const { data: form } = await admin
    .from('forms')
    .select('id, latest_published_version_id, workflow_request_expiry_days')
    .eq('workflow_key', body.workflowKey)
    .eq('status', 'published')
    .is('archived_at', null)
    .maybeSingle();
  if (!form?.latest_published_version_id) {
    return NextResponse.json({ error: 'Assign and publish a form for this workflow first.' }, { status: 409 });
  }

  const ids = body.enrolments.map((row) => row.classesStudentsId!);
  const { data: activeEnrolments } = await admin
    .from('classes_students')
    .select('id')
    .eq('student_id', body.studentId)
    .in('id', ids)
    .is('unenrolled_at', null);
  if ((activeEnrolments ?? []).length !== ids.length) {
    return NextResponse.json({ error: 'One or more selected classes are no longer active.' }, { status: 409 });
  }

  await admin
    .from('student_exit_requests')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoked_by: auth.staffId, revoke_reason: 'Replaced by a newer request' })
    .eq('student_id', body.studentId)
    .eq('status', 'pending');

  const token = randomBytes(24).toString('base64url');
  const expiresAt = form.workflow_request_expiry_days
    ? new Date(Date.now() + form.workflow_request_expiry_days * 86400000).toISOString()
    : null;
  const { data: formToken, error: tokenError } = await admin.from('form_tokens').insert({
    form_id: form.id,
    form_version_id: form.latest_published_version_id,
    token_hash: hashToken(token),
    access_type: 'authenticated',
    submission_limit: 'one_per_token',
    expires_at: expiresAt,
    created_by: auth.staffId,
  }).select('id').single();
  if (tokenError) return NextResponse.json({ error: tokenError.message }, { status: 500 });
  const { data: exitRequest, error: requestError } = await admin.from('student_exit_requests').insert({
    workflow_key: body.workflowKey,
    student_id: body.studentId,
    form_id: form.id,
    form_version_id: form.latest_published_version_id,
    form_token_id: formToken.id,
    requested_by: auth.staffId,
    expires_at: expiresAt,
  }).select('id').single();
  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 });
  const { error: enrolmentError } = await admin.from('student_exit_request_enrolments').insert(
    body.enrolments.map((row) => ({
      student_exit_request_id: exitRequest.id,
      classes_students_id: row.classesStudentsId,
      final_session_at: row.finalSessionAt,
      unenrolled_at: row.unenrolledAt,
    })),
  );
  if (enrolmentError) return NextResponse.json({ error: enrolmentError.message }, { status: 500 });
  return NextResponse.json({ request: exitRequest, token, expiresAt });
}
