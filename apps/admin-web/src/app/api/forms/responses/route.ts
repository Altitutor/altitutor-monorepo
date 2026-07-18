import { captureApiError, captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextResponse } from 'next/server';
import {
  normalizeFormAnswers,
  validateFormAnswers,
  type FormAnswerPayload,
  type FormBlock,
  type Json,
} from '@altitutor/shared';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
import { resolveFormBlocks } from '@/features/forms/server/resolve-form-blocks';

function asBlocks(value: unknown): FormBlock[] {
  return Array.isArray(value) ? value as FormBlock[] : [];
}

function asAnswers(value: unknown): FormAnswerPayload {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as FormAnswerPayload : {};
}

export async function GET(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const formId = searchParams.get('formId');
  const responseId = searchParams.get('responseId');
  const admin = auth.admin;

  let query = admin
    .from('form_responses')
    .select(`
      *,
      sessions ( id, start_at, short_name, long_name ),
      forms ( id, name, purpose ),
      form_versions ( id, version_number, blocks ),
      respondent_student:students!form_responses_respondent_student_id_fkey ( id, first_name, last_name ),
      respondent_staff:staff!form_responses_respondent_staff_id_fkey ( id, first_name, last_name ),
      respondent_parent:parents!form_responses_respondent_parent_id_fkey ( id, first_name, last_name ),
      recorded_by_staff:staff!form_responses_recorded_by_staff_id_fkey ( id, first_name, last_name ),
      subject_student:students!form_responses_subject_student_id_fkey ( id, first_name, last_name ),
      subject_staff:staff!form_responses_subject_staff_id_fkey ( id, first_name, last_name ),
      subject_parent:parents!form_responses_subject_parent_id_fkey ( id, first_name, last_name ),
      form_response_answers ( id, question_id, question_label_snapshot, question_type, choice_value, choice_label_snapshot, choice_values, text_value, number_value )
    `)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })
    .limit(500);

  if (formId) query = query.eq('form_id', formId);
  if (responseId) query = query.eq('id', responseId);
  const { data, error } = await query;

  if (error) {
    captureApiError(error, "/api/forms/responses");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const responses = await Promise.all((data ?? []).map(async (response) => ({
    ...response,
    form_versions: response.form_versions
      ? { ...response.form_versions, blocks: await resolveFormBlocks(auth.admin, asBlocks(response.form_versions.blocks)) }
      : null,
  })));
  return NextResponse.json({ responses });
}

export async function PUT(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({})) as { responseId?: string; answers?: unknown };
  if (!body.responseId) return NextResponse.json({ error: 'Response is required.' }, { status: 400 });

  const { data: response, error } = await auth.admin.from('form_responses')
    .select('id, form_id, form_version_id, session_id, respondent_type, respondent_student_id, respondent_staff_id, respondent_parent_id, subject_type, subject_student_id, subject_staff_id, subject_parent_id, forms(name), form_versions(blocks)')
    .eq('id', body.responseId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return captureApiErrorResponse(error, "/api/forms/responses", NextResponse.json({ error: error.message }, { status: 500 }));
  if (!response?.form_versions) return NextResponse.json({ error: 'Response not found.' }, { status: 404 });

  const blocks = await resolveFormBlocks(auth.admin, asBlocks(response.form_versions.blocks));
  const answers = asAnswers(body.answers);
  const validationErrors = validateFormAnswers(blocks, answers);
  if (validationErrors.length) return NextResponse.json({ error: validationErrors.join(' ') }, { status: 400 });

  const normalized = normalizeFormAnswers(blocks, answers).map((answer) => ({
    form_response_id: response.id,
    form_id: response.form_id,
    form_version_id: response.form_version_id,
    question_id: answer.questionId,
    question_label_snapshot: answer.questionLabelSnapshot,
    question_type: answer.questionType,
    choice_value: answer.choiceValue ?? null,
    choice_label_snapshot: answer.choiceLabelSnapshot ?? null,
    choice_values: (answer.choiceValues ?? null) as Json,
    text_value: answer.textValue ?? null,
    number_value: answer.numberValue ?? null,
  }));
  const { error: deleteError } = await auth.admin.from('form_response_answers').delete().eq('form_response_id', response.id);
  if (deleteError) return captureApiErrorResponse(deleteError, "/api/forms/responses", NextResponse.json({ error: deleteError.message }, { status: 500 }));
  if (normalized.length) {
    const { error: insertError } = await auth.admin.from('form_response_answers').insert(normalized);
    if (insertError) return captureApiErrorResponse(insertError, "/api/forms/responses", NextResponse.json({ error: insertError.message }, { status: 500 }));
  }
  const { error: updateError } = await auth.admin.from('form_responses')
    .update({ response_json: { answers } as Json })
    .eq('id', response.id);
  if (updateError) return captureApiErrorResponse(updateError, "/api/forms/responses", NextResponse.json({ error: updateError.message }, { status: 500 }));

  const formName = response.forms && typeof response.forms === 'object' && 'name' in response.forms
    ? response.forms.name
    : null;
  await auth.admin.from('activity_events').insert({
    entity_type: 'form_responses',
    entity_id: response.id,
    event_type: 'UPDATED',
    session_id: response.session_id,
    student_id: response.subject_student_id,
    staff_id: response.subject_staff_id,
    parent_id: response.subject_parent_id,
    performed_by: auth.staffId,
    metadata: { form_id: response.form_id, form_name: formName, form_response_id: response.id },
  });
  return NextResponse.json({ responseId: response.id });
}
