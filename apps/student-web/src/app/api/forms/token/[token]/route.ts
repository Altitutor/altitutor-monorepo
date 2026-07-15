import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient as createUserClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import {
  normalizeFormAnswers,
  validateFormAnswers,
  type FormAnswerPayload,
  type FormBlock,
  type Json,
} from '@altitutor/shared';
import { resolveFormBlocks } from '@/shared/lib/forms/resolve-form-blocks';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

function asFormBlocks(value: unknown): FormBlock[] {
  return Array.isArray(value) ? (value as FormBlock[]) : [];
}

function asFormAnswers(value: unknown): FormAnswerPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as FormAnswerPayload;
}

function getSessionContext(metadata: Json): { sessionId: string; studentId: string } | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const sessionId = metadata.session_id;
  const studentId = metadata.respondent_id;
  return metadata.context === 'check_in_session' && typeof sessionId === 'string' && typeof studentId === 'string'
    ? { sessionId, studentId }
    : null;
}

async function resolveToken(token: string) {
  const admin = getServerSupabaseAdmin();
  const { data, error } = await admin
    .from('form_tokens')
    .select(`
      *,
      forms ( id, name, purpose, status ),
      form_versions ( id, version_number, blocks, thank_you_message )
    `)
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null)
    .maybeSingle();
  if (error || !data) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

async function getStudentIdentity() {
  const userClient = createUserClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { user: null, student: null };
  const admin = getServerSupabaseAdmin();
  const { data: student } = await admin.from('students').select('id').eq('user_id', user.id).maybeSingle();
  return { user, student };
}

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const tokenRow = await resolveToken(params.token);
  if (!tokenRow) return NextResponse.json({ error: 'Form link not found' }, { status: 404 });
  let authenticatedStudentId: string | null = null;
  if (tokenRow.access_type === 'authenticated') {
    const { student } = await getStudentIdentity();
    if (!student) return NextResponse.json({ error: 'Sign in to answer this form' }, { status: 401 });
    authenticatedStudentId = student.id;
  }
  const sessionContext = getSessionContext(tokenRow.metadata);
  if (sessionContext && authenticatedStudentId && sessionContext.studentId !== authenticatedStudentId) {
    return NextResponse.json({ error: 'This form link belongs to another student.' }, { status: 403 });
  }
  if (!tokenRow.forms || !tokenRow.form_versions) {
    return NextResponse.json({ error: 'Form link not found' }, { status: 404 });
  }
  const admin = getServerSupabaseAdmin();
  const { data: exitRequest } = await admin
    .from('student_exit_requests')
    .select('id, workflow_key, student_id, status')
    .eq('form_token_id', tokenRow.id)
    .maybeSingle();
  if (exitRequest && exitRequest.student_id !== authenticatedStudentId) {
    return NextResponse.json({ error: 'This form link belongs to another student.' }, { status: 403 });
  }
  if (exitRequest && exitRequest.status !== 'pending') {
    return NextResponse.json({ error: 'This exit request is no longer active.' }, { status: 410 });
  }
  const { data: requestEnrolments } = exitRequest
    ? await admin
      .from('student_exit_request_enrolments')
      .select('id, classes_students_id, classes_students(class_id, classes(id, short_name, long_name, day_of_week, start_time))')
      .eq('student_exit_request_id', exitRequest.id)
    : { data: [] };
  const sessionGroups = await Promise.all((requestEnrolments ?? []).map(async (requestEnrolment) => {
    const classId = requestEnrolment.classes_students?.class_id;
    if (!classId) return [];
    const now = new Date().toISOString();
    const [{ data: mostRecentPast }, { data: futureSessions }] = await Promise.all([
      admin.from('sessions').select('id, class_id, start_at').eq('class_id', classId).lte('start_at', now).order('start_at', { ascending: false }).limit(1),
      admin.from('sessions').select('id, class_id, start_at').eq('class_id', classId).gt('start_at', now).order('start_at').limit(16),
    ]);
    return [...(mostRecentPast ?? []), ...(futureSessions ?? [])];
  }));
  const sessions = sessionGroups.flat();
  const blocks = await resolveFormBlocks(admin, asFormBlocks(tokenRow.form_versions.blocks));

  return NextResponse.json({
    form: {
      id: tokenRow.forms.id,
      name: tokenRow.forms.name,
      purpose: tokenRow.forms.purpose,
      versionId: tokenRow.form_versions.id,
      versionNumber: tokenRow.form_versions.version_number,
      blocks,
      thankYouMessage: tokenRow.form_versions.thank_you_message,
    },
    exitRequest: exitRequest ? {
      workflowKey: exitRequest.workflow_key,
      enrolments: requestEnrolments ?? [],
      sessions,
    } : null,
  });
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const tokenRow = await resolveToken(params.token);
  if (!tokenRow) return NextResponse.json({ error: 'Form link not found' }, { status: 404 });
  if (!tokenRow.form_versions) {
    return NextResponse.json({ error: 'Form link not found' }, { status: 404 });
  }

  const { user, student } = await getStudentIdentity();
  if (tokenRow.access_type === 'authenticated' && !student) {
    return NextResponse.json({ error: 'Sign in to answer this form' }, { status: 401 });
  }
  const sessionContext = getSessionContext(tokenRow.metadata);
  if (sessionContext && student && sessionContext.studentId !== student.id) {
    return NextResponse.json({ error: 'This form link belongs to another student.' }, { status: 403 });
  }
  const respondentStudentId = sessionContext?.studentId ?? student?.id ?? null;

  const body = await request.json().catch(() => ({})) as {
    answers?: unknown;
    exitSelections?: Array<{ requestEnrolmentId?: string; sessionId?: string }>;
  };
  const answers = asFormAnswers(body.answers);
  const admin = getServerSupabaseAdmin();
  const blocks = await resolveFormBlocks(admin, asFormBlocks(tokenRow.form_versions.blocks));
  const errors = validateFormAnswers(blocks, answers);
  if (errors.length) return NextResponse.json({ error: errors.join(' ') }, { status: 400 });

  const normalized = normalizeFormAnswers(blocks, answers);
  const { data: exitRequest } = await admin
    .from('student_exit_requests')
    .select('id, workflow_key, student_id')
    .eq('form_token_id', tokenRow.id)
    .maybeSingle();
  if (exitRequest) {
    if (!student) return NextResponse.json({ error: 'Sign in to answer this form' }, { status: 401 });
    if (exitRequest.student_id !== student.id) {
      return NextResponse.json({ error: 'This form link belongs to another student.' }, { status: 403 });
    }
    const { data: requestEnrolments } = await admin
      .from('student_exit_request_enrolments')
      .select('id, classes_students(class_id)')
      .eq('student_exit_request_id', exitRequest.id);
    const requestedSelections = body.exitSelections ?? [];
    if (requestedSelections.length !== (requestEnrolments ?? []).length) {
      return NextResponse.json({ error: 'Choose the final session for every class.' }, { status: 400 });
    }
    const validatedSelections: Array<{ requestEnrolmentId: string; finalSessionAt: string }> = [];
    for (const requestEnrolment of requestEnrolments ?? []) {
      const selection = requestedSelections.find((candidate) => candidate.requestEnrolmentId === requestEnrolment.id);
      const classId = requestEnrolment.classes_students?.class_id;
      if (!selection?.sessionId || !classId) {
        return NextResponse.json({ error: 'Choose the final session for every class.' }, { status: 400 });
      }
      const now = new Date().toISOString();
      const [{ data: mostRecentPast }, { data: futureSessions }] = await Promise.all([
        admin.from('sessions').select('id').eq('class_id', classId).lte('start_at', now).order('start_at', { ascending: false }).limit(1),
        admin.from('sessions').select('id').eq('class_id', classId).gt('start_at', now).order('start_at').limit(16),
      ]);
      const allowedSessionIds = new Set([...(mostRecentPast ?? []), ...(futureSessions ?? [])].map((session) => session.id));
      if (!allowedSessionIds.has(selection.sessionId)) {
        return NextResponse.json({ error: 'Choose one of the available final sessions.' }, { status: 400 });
      }
      const { data: selectedSession } = await admin
        .from('sessions')
        .select('id, start_at')
        .eq('id', selection.sessionId)
        .eq('class_id', classId)
        .maybeSingle();
      if (!selectedSession?.start_at) {
        return NextResponse.json({ error: 'One of the selected sessions is no longer available.' }, { status: 409 });
      }
      validatedSelections.push({ requestEnrolmentId: requestEnrolment.id, finalSessionAt: selectedSession.start_at });
    }
    const { data, error } = await admin.rpc('complete_student_exit_request', {
      p_form_token_id: tokenRow.id,
      p_student_id: student.id,
      p_submitted_by_user_id: user?.id ?? null,
      p_response_json: { answers } as Json,
      p_answers: normalized as unknown as Json,
      p_exit_selections: validatedSelections as unknown as Json,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    const result = data as { success?: boolean; error?: string; already_completed?: boolean; scheduled?: boolean } | null;
    if (!result?.success) return NextResponse.json({ error: result?.error ?? 'Could not complete this exit request.' }, { status: 409 });
    return NextResponse.json({ ok: true, alreadyCompleted: Boolean(result.already_completed), scheduled: Boolean(result.scheduled) });
  }
  if (tokenRow.submission_limit === 'one_per_token') {
    const { count } = await admin
      .from('form_responses')
      .select('id', { count: 'exact', head: true })
      .eq('form_token_id', tokenRow.id)
      .is('deleted_at', null);
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'This form link has already been used.' }, { status: 409 });
  }
  if (tokenRow.submission_limit === 'one_per_authenticated_respondent' && respondentStudentId) {
    const { count } = await admin
      .from('form_responses')
      .select('id', { count: 'exact', head: true })
      .eq('form_version_id', tokenRow.form_version_id)
      .eq('respondent_student_id', respondentStudentId)
      .is('deleted_at', null);
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'You have already submitted this form.' }, { status: 409 });
  }

  const { data: response, error: responseError } = await admin
    .from('form_responses')
    .insert({
      form_id: tokenRow.form_id,
      form_version_id: tokenRow.form_version_id,
      form_token_id: tokenRow.id,
      session_id: sessionContext?.sessionId ?? null,
      respondent_type: respondentStudentId ? 'student' : 'anonymous',
      respondent_student_id: respondentStudentId,
      subject_type: respondentStudentId ? 'student' : 'none',
      subject_student_id: respondentStudentId,
      submitted_by_user_id: user?.id ?? null,
      response_json: { answers } as Json,
    })
    .select('*')
    .single();

  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 });

  const responseAnswers = normalized.map((answer) => ({
    form_response_id: response.id,
    form_id: tokenRow.form_id,
    form_version_id: tokenRow.form_version_id,
    question_id: answer.questionId,
    question_label_snapshot: answer.questionLabelSnapshot,
    question_type: answer.questionType,
    choice_value: answer.choiceValue ?? null,
    choice_label_snapshot: answer.choiceLabelSnapshot ?? null,
    choice_values: (answer.choiceValues ?? null) as Json,
    text_value: answer.textValue ?? null,
    number_value: answer.numberValue ?? null,
  }));
  if (responseAnswers.length) {
    const { error: answersError } = await admin.from('form_response_answers').insert(responseAnswers);
    if (answersError) return NextResponse.json({ error: answersError.message }, { status: 500 });
  }

  if (sessionContext) {
    await admin.from('activity_events').insert({
      entity_type: 'form_responses',
      entity_id: response.id,
      event_type: 'CREATED',
      session_id: sessionContext.sessionId,
      student_id: sessionContext.studentId,
      metadata: {
        form_id: tokenRow.form_id,
        form_name: tokenRow.forms?.name ?? 'Form',
        form_response_id: response.id,
        recorded_on_behalf: false,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
