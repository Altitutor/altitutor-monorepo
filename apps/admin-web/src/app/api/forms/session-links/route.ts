import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import type { Json } from '@altitutor/shared';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('base64url');
}

export async function POST(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({})) as { formId?: string; sessionId?: string; studentId?: string };
  if (!body.formId || !body.sessionId || !body.studentId) {
    return NextResponse.json({ error: 'Form, session and student are required.' }, { status: 400 });
  }

  const [{ data: participant }, { data: form }] = await Promise.all([
    auth.admin.from('sessions_students').select('id').eq('session_id', body.sessionId).eq('student_id', body.studentId).maybeSingle(),
    auth.admin.from('forms').select('id, latest_published_version_id, access_type').eq('id', body.formId).eq('status', 'published').is('archived_at', null).is('workflow_key', null).maybeSingle(),
  ]);
  if (!participant) return NextResponse.json({ error: 'That student is not part of this session.' }, { status: 409 });
  if (!form?.latest_published_version_id) return NextResponse.json({ error: 'Select a published form that is not assigned to a workflow action.' }, { status: 409 });

  const token = randomBytes(24).toString('base64url');
  const metadata = {
    context: 'check_in_session',
    session_id: body.sessionId,
    respondent_type: 'student',
    respondent_id: body.studentId,
  } as Json;
  const { error } = await auth.admin.from('form_tokens').insert({
    form_id: form.id,
    form_version_id: form.latest_published_version_id,
    token_hash: hashToken(token),
    access_type: form.access_type,
    submission_limit: 'one_per_token',
    created_by: auth.staffId,
    metadata,
  });
  if (error) return captureApiErrorResponse(error, "/api/forms/session-links", NextResponse.json({ error: error.message }, { status: 500 }));

  const baseUrl = process.env.NODE_ENV === 'development'
    ? (process.env.NEXT_PUBLIC_STUDENT_URL || 'http://localhost:3001')
    : (process.env.NEXT_PUBLIC_STUDENT_URL || 'https://student.altitutor.com');
  return NextResponse.json({ url: `${baseUrl.replace(/\/$/, '')}/form/${token}` });
}
