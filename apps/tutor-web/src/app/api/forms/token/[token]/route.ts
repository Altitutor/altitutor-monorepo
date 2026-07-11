import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient as createUserClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { normalizeFormAnswers, validateFormAnswers } from '@altitutor/shared';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

async function resolveToken(token: string) {
  const admin = supabaseAdmin as any;
  if (!admin) return null;
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

async function getStaffIdentity() {
  const userClient = createUserClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user || !supabaseAdmin) return { user: null, staff: null };
  const { data: staff } = await (supabaseAdmin as any)
    .from('staff')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  return { user, staff };
}

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const tokenRow = await resolveToken(params.token);
  if (!tokenRow) return NextResponse.json({ error: 'Form link not found' }, { status: 404 });
  if (tokenRow.access_type === 'authenticated') {
    const { staff } = await getStaffIdentity();
    if (!staff) return NextResponse.json({ error: 'Sign in to answer this form' }, { status: 401 });
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
  if (!tokenRow || !supabaseAdmin) return NextResponse.json({ error: 'Form link not found' }, { status: 404 });

  const { user, staff } = await getStaffIdentity();
  if (tokenRow.access_type === 'authenticated' && !staff) {
    return NextResponse.json({ error: 'Sign in to answer this form' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const answers = body.answers ?? {};
  const blocks = tokenRow.form_versions.blocks ?? [];
  const errors = validateFormAnswers(blocks, answers);
  if (errors.length) return NextResponse.json({ error: errors.join(' ') }, { status: 400 });

  const admin = supabaseAdmin as any;
  if (tokenRow.submission_limit === 'one_per_token') {
    const { count } = await admin
      .from('form_responses')
      .select('id', { count: 'exact', head: true })
      .eq('form_token_id', tokenRow.id)
      .is('deleted_at', null);
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'This form link has already been used.' }, { status: 409 });
  }
  if (tokenRow.submission_limit === 'one_per_authenticated_respondent' && staff) {
    const { count } = await admin
      .from('form_responses')
      .select('id', { count: 'exact', head: true })
      .eq('form_version_id', tokenRow.form_version_id)
      .eq('respondent_staff_id', staff.id)
      .is('deleted_at', null);
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'You have already submitted this form.' }, { status: 409 });
  }

  const { data: response, error: responseError } = await admin
    .from('form_responses')
    .insert({
      form_id: tokenRow.form_id,
      form_version_id: tokenRow.form_version_id,
      form_token_id: tokenRow.id,
      respondent_type: staff ? 'staff' : 'anonymous',
      respondent_staff_id: staff?.id ?? null,
      subject_type: staff ? 'staff' : 'none',
      subject_staff_id: staff?.id ?? null,
      submitted_by_user_id: user?.id ?? null,
      response_json: { answers },
    })
    .select('*')
    .single();

  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 });

  const normalized = normalizeFormAnswers(blocks, answers).map((answer) => ({
    form_response_id: response.id,
    form_id: tokenRow.form_id,
    form_version_id: tokenRow.form_version_id,
    question_id: answer.questionId,
    question_label_snapshot: answer.questionLabelSnapshot,
    question_type: answer.questionType,
    choice_value: answer.choiceValue ?? null,
    choice_label_snapshot: answer.choiceLabelSnapshot ?? null,
    choice_values: answer.choiceValues ?? null,
    text_value: answer.textValue ?? null,
    number_value: answer.numberValue ?? null,
  }));
  if (normalized.length) {
    const { error: answersError } = await admin.from('form_response_answers').insert(normalized);
    if (answersError) return NextResponse.json({ error: answersError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
