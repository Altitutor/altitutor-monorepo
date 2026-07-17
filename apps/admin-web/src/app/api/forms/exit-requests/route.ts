import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

const WORKFLOW_KEYS = ['student_unenrolment', 'student_discontinuation'] as const;
type WorkflowKey = (typeof WORKFLOW_KEYS)[number];

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('base64url');
}

function isWorkflowKey(value: unknown): value is WorkflowKey {
  return typeof value === 'string' && (WORKFLOW_KEYS as readonly string[]).includes(value);
}

function studentFormUrl(token: string) {
  const baseUrl = process.env.NODE_ENV === 'development'
    ? (process.env.NEXT_PUBLIC_STUDENT_URL || 'http://localhost:3001')
    : (process.env.NEXT_PUBLIC_STUDENT_URL || 'https://student.altitutor.com');
  return `${baseUrl.replace(/\/$/, '')}/unenrol/${token}`;
}

export async function GET(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const studentId = new URL(request.url).searchParams.get('studentId');
  if (!studentId) return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  const admin = auth.admin;
  const { data: enrolments, error } = await admin
    .from('classes_students')
    .select('id, class_id, classes(id, short_name, long_name)')
    .eq('student_id', studentId)
    .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const classIds = (enrolments ?? []).map((row) => row.class_id);
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
    classId?: string;
    classesStudentsId?: string;
    enrolments?: Array<{ classesStudentsId?: string; finalSessionAt?: string; unenrolledAt?: string }>;
  };
  if (!body?.studentId || !isWorkflowKey(body.workflowKey)) {
    return NextResponse.json({ error: 'Student and workflow are required.' }, { status: 400 });
  }
  const enrolments = body.enrolments ?? [];
  if (body.workflowKey === 'student_unenrolment' && !body.classId && !body.classesStudentsId && !enrolments.length) {
    return NextResponse.json({ error: 'Choose the class to unenrol from.' }, { status: 400 });
  }
  if (enrolments.some((row) => !row.classesStudentsId || !row.finalSessionAt || !row.unenrolledAt)) {
    return NextResponse.json({ error: 'Each class needs a final session date.' }, { status: 400 });
  }

  const admin = auth.admin;
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

  let targetedClassesStudentsId = body.classesStudentsId;
  if (!targetedClassesStudentsId && body.classId) {
    const { data: activeEnrolment } = await admin
      .from('classes_students')
      .select('id')
      .eq('student_id', body.studentId)
      .eq('class_id', body.classId)
      .is('unenrolled_at', null)
      .maybeSingle();
    targetedClassesStudentsId = activeEnrolment?.id;
    if (!targetedClassesStudentsId) return NextResponse.json({ error: 'This class enrolment is no longer active.' }, { status: 409 });
  }
  let ids = targetedClassesStudentsId
    ? [targetedClassesStudentsId]
    : enrolments.map((row) => row.classesStudentsId!);
  if (body.workflowKey === 'student_discontinuation') {
    const { data: activeStudentEnrolments, error: activeStudentEnrolmentsError } = await admin
      .from('classes_students')
      .select('id')
      .eq('student_id', body.studentId)
      .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
    if (activeStudentEnrolmentsError) {
      return NextResponse.json({ error: activeStudentEnrolmentsError.message }, { status: 500 });
    }
    ids = (activeStudentEnrolments ?? []).map((row) => row.id);
  }
  const { data: activeEnrolments } = ids.length ? await admin
    .from('classes_students')
    .select('id')
    .eq('student_id', body.studentId)
    .in('id', ids)
    .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`) : { data: [] };
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
  const requestEnrolments = body.workflowKey === 'student_discontinuation'
    ? ids.map((classesStudentsId) => ({ classesStudentsId, finalSessionAt: null, unenrolledAt: null }))
    : targetedClassesStudentsId
      ? [{ classesStudentsId: targetedClassesStudentsId, finalSessionAt: null, unenrolledAt: null }]
      : enrolments;
  const { error: enrolmentError } = requestEnrolments.length ? await admin.from('student_exit_request_enrolments').insert(
    requestEnrolments.map((row) => ({
      student_exit_request_id: exitRequest.id,
      classes_students_id: row.classesStudentsId!,
      final_session_at: row.finalSessionAt ?? null,
      unenrolled_at: row.unenrolledAt ?? null,
    })),
  ) : { error: null };
  if (enrolmentError) return NextResponse.json({ error: enrolmentError.message }, { status: 500 });
  return NextResponse.json({ request: exitRequest, token, url: studentFormUrl(token), expiresAt });
}
