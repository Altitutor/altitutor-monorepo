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
  if (tokenRow.access_type === 'authenticated') {
    const { student } = await getStudentIdentity();
    if (!student) return NextResponse.json({ error: 'Sign in to answer this form' }, { status: 401 });
  }
  if (!tokenRow.forms || !tokenRow.form_versions) {
    return NextResponse.json({ error: 'Form link not found' }, { status: 404 });
  }
  return NextResponse.json({
    form: {
      id: tokenRow.forms.id,
      name: tokenRow.forms.name,
      purpose: tokenRow.forms.purpose,
      versionId: tokenRow.form_versions.id,
      versionNumber: tokenRow.form_versions.version_number,
      blocks: tokenRow.form_versions.blocks,
      thankYouMessage: tokenRow.form_versions.thank_you_message,
    },
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

  const body = await request.json().catch(() => ({})) as { answers?: unknown };
  const answers = asFormAnswers(body.answers);
  const blocks = asFormBlocks(tokenRow.form_versions.blocks);
  const errors = validateFormAnswers(blocks, answers);
  if (errors.length) return NextResponse.json({ error: errors.join(' ') }, { status: 400 });

  const admin = getServerSupabaseAdmin();
  const normalized = normalizeFormAnswers(blocks, answers);
  const { data: exitRequest } = await admin
    .from('student_exit_requests')
    .select('id')
    .eq('form_token_id', tokenRow.id)
    .maybeSingle();
  if (exitRequest) {
    if (!student) return NextResponse.json({ error: 'Sign in to answer this form' }, { status: 401 });
    const { data, error } = await admin.rpc('complete_student_exit_request', {
      p_form_token_id: tokenRow.id,
      p_student_id: student.id,
      p_submitted_by_user_id: user?.id ?? null,
      p_response_json: { answers } as Json,
      p_answers: normalized as unknown as Json,
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
  if (tokenRow.submission_limit === 'one_per_authenticated_respondent' && student) {
    const { count } = await admin
      .from('form_responses')
      .select('id', { count: 'exact', head: true })
      .eq('form_version_id', tokenRow.form_version_id)
      .eq('respondent_student_id', student.id)
      .is('deleted_at', null);
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'You have already submitted this form.' }, { status: 409 });
  }

  const { data: response, error: responseError } = await admin
    .from('form_responses')
    .insert({
      form_id: tokenRow.form_id,
      form_version_id: tokenRow.form_version_id,
      form_token_id: tokenRow.id,
      respondent_type: student ? 'student' : 'anonymous',
      respondent_student_id: student?.id ?? null,
      subject_type: student ? 'student' : 'none',
      subject_student_id: student?.id ?? null,
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

  return NextResponse.json({ ok: true });
}
