import { captureApiError, captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextResponse } from 'next/server';
import {
  normalizeFormAnswers,
  validateFormAnswers,
  type FormAnswerPayload,
  type FormBlock,
  type Json,
  type TablesInsert,
} from '@altitutor/shared';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
import { resolveFormBlocks } from '@/features/forms/server/resolve-form-blocks';

type RespondentType = 'student' | 'parent' | 'staff';
type LatestForm = {
  id: string;
  name: string;
  purpose: string;
  latest_published_version_id: string | null;
  form_versions: { id: string; blocks: unknown; thank_you_message: string; version_number: number } | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asBlocks(value: unknown): FormBlock[] {
  return Array.isArray(value) ? value as FormBlock[] : [];
}

function asAnswers(value: unknown): FormAnswerPayload {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as FormAnswerPayload : {};
}

export async function GET() {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.admin
    .from('forms')
    .select('id, name, purpose, latest_published_version_id, form_versions!forms_latest_published_version_id_fkey(id, blocks, thank_you_message, version_number)')
    .eq('status', 'published')
    .is('archived_at', null)
    .is('workflow_key', null)
    .not('latest_published_version_id', 'is', null)
    .order('name');
  if (error) return captureApiErrorResponse(error, "/api/forms/manual-responses", NextResponse.json({ error: error.message }, { status: 500 }));

  const forms = await Promise.all(((data ?? []) as unknown as LatestForm[]).map(async (form) => ({
    ...form,
    form_versions: form.form_versions ? {
      ...form.form_versions,
      blocks: await resolveFormBlocks(auth.admin, asBlocks(form.form_versions.blocks)),
    } : null,
  })));
  return NextResponse.json({ forms });
}

export async function POST(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({})) as {
    formId?: string;
    respondentType?: RespondentType;
    respondentId?: string;
    sessionId?: string | null;
    idempotencyKey?: string;
    answers?: unknown;
  };
  if (!body.formId || !body.respondentId || !['student', 'parent', 'staff'].includes(body.respondentType ?? '')) {
    return NextResponse.json({ error: 'Form and respondent are required.' }, { status: 400 });
  }
  if (!body.idempotencyKey || !UUID_PATTERN.test(body.idempotencyKey)) {
    return NextResponse.json({ error: 'A valid idempotency key is required.' }, { status: 400 });
  }
  const respondentType = body.respondentType!;
  const table = respondentType === 'student' ? 'students' : respondentType === 'parent' ? 'parents' : 'staff';
  const { data: person } = await auth.admin.from(table).select('id').eq('id', body.respondentId).maybeSingle();
  if (!person) return NextResponse.json({ error: 'Respondent not found.' }, { status: 404 });

  if (body.sessionId) {
    if (respondentType === 'student') {
      const { data: participant } = await auth.admin.from('sessions_students')
        .select('id').eq('session_id', body.sessionId).eq('student_id', body.respondentId).maybeSingle();
      if (!participant) return NextResponse.json({ error: 'That student is not part of this session.' }, { status: 409 });
    } else if (respondentType === 'parent') {
      const { data: sessionParent } = await auth.admin.from('sessions_parents')
        .select('id').eq('session_id', body.sessionId).eq('parent_id', body.respondentId).maybeSingle();
      if (!sessionParent) {
        const { data: sessionStudents } = await auth.admin.from('sessions_students').select('student_id').eq('session_id', body.sessionId);
        const studentIds = (sessionStudents ?? []).map((row) => row.student_id);
        const { data: parentLink } = studentIds.length
          ? await auth.admin.from('parents_students').select('id').eq('parent_id', body.respondentId).in('student_id', studentIds).limit(1).maybeSingle()
          : { data: null };
        if (!parentLink) {
          return NextResponse.json({ error: 'That parent is not part of this session.' }, { status: 409 });
        }
      }
    } else {
      const { data: participant } = await auth.admin.from('sessions_staff')
        .select('id').eq('session_id', body.sessionId).eq('staff_id', body.respondentId).maybeSingle();
      if (!participant) return NextResponse.json({ error: 'That staff member is not part of this session.' }, { status: 409 });
    }
  }

  const { data: formData } = await auth.admin.from('forms')
    .select('id, name, latest_published_version_id, form_versions!forms_latest_published_version_id_fkey(id, blocks)')
    .eq('id', body.formId).eq('status', 'published').is('archived_at', null).is('workflow_key', null).maybeSingle();
  const form = formData as unknown as { id: string; name: string; latest_published_version_id: string | null; form_versions: { id: string; blocks: unknown } | null } | null;
  if (!form?.latest_published_version_id || !form.form_versions) {
    return NextResponse.json({ error: 'Select a published form that is not assigned to a workflow action.' }, { status: 409 });
  }
  const blocks = await resolveFormBlocks(auth.admin, asBlocks(form.form_versions.blocks));
  const answers = asAnswers(body.answers);
  const errors = validateFormAnswers(blocks, answers);
  if (errors.length) return NextResponse.json({ error: errors.join(' ') }, { status: 400 });

  const insert: TablesInsert<'form_responses'> = {
    form_id: form.id,
    form_version_id: form.latest_published_version_id,
    session_id: body.sessionId ?? null,
    respondent_type: respondentType,
    respondent_student_id: respondentType === 'student' ? body.respondentId : null,
    respondent_parent_id: respondentType === 'parent' ? body.respondentId : null,
    respondent_staff_id: respondentType === 'staff' ? body.respondentId : null,
    subject_type: respondentType,
    subject_student_id: respondentType === 'student' ? body.respondentId : null,
    subject_parent_id: respondentType === 'parent' ? body.respondentId : null,
    subject_staff_id: respondentType === 'staff' ? body.respondentId : null,
    recorded_by_staff_id: auth.staffId,
    idempotency_key: body.idempotencyKey,
    response_json: { answers } as Json,
  };
  const { data: response, error: responseError } = await auth.admin.from('form_responses').insert(insert).select('id').single();
  if (responseError) {
    if (responseError.code === '23505') {
      const { data: existingResponse, error: existingError } = await auth.admin.from('form_responses')
        .select('id, form_id, session_id, respondent_type, respondent_student_id, respondent_parent_id, respondent_staff_id, recorded_by_staff_id')
        .eq('idempotency_key', body.idempotencyKey)
        .maybeSingle();
      if (existingError) {
        return captureApiErrorResponse(existingError, "/api/forms/manual-responses", NextResponse.json({ error: existingError.message }, { status: 500 }));
      }
      const sameRequest = existingResponse
        && existingResponse.form_id === form.id
        && existingResponse.session_id === (body.sessionId ?? null)
        && existingResponse.respondent_type === respondentType
        && existingResponse.respondent_student_id === (respondentType === 'student' ? body.respondentId : null)
        && existingResponse.respondent_parent_id === (respondentType === 'parent' ? body.respondentId : null)
        && existingResponse.respondent_staff_id === (respondentType === 'staff' ? body.respondentId : null)
        && existingResponse.recorded_by_staff_id === auth.staffId;
      if (sameRequest) return NextResponse.json({ responseId: existingResponse.id });
      return NextResponse.json({ error: 'That idempotency key has already been used.' }, { status: 409 });
    }
    return captureApiErrorResponse(responseError, "/api/forms/manual-responses", NextResponse.json({ error: responseError.message }, { status: 500 }));
  }

  const normalized = normalizeFormAnswers(blocks, answers).map((answer) => ({
    form_response_id: response.id,
    form_id: form.id,
    form_version_id: form.latest_published_version_id!,
    question_id: answer.questionId,
    question_label_snapshot: answer.questionLabelSnapshot,
    question_type: answer.questionType,
    choice_value: answer.choiceValue ?? null,
    choice_label_snapshot: answer.choiceLabelSnapshot ?? null,
    choice_values: (answer.choiceValues ?? null) as Json,
    text_value: answer.textValue ?? null,
    number_value: answer.numberValue ?? null,
  }));
  if (normalized.length) {
    const { error } = await auth.admin.from('form_response_answers').insert(normalized);
    if (error) {
      await auth.admin.from('form_responses').delete().eq('id', response.id);
      captureApiError(error, "/api/forms/manual-responses");
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await auth.admin.from('activity_events').insert({
    entity_type: 'form_responses',
    entity_id: response.id,
    event_type: 'CREATED',
    session_id: body.sessionId ?? null,
    student_id: respondentType === 'student' ? body.respondentId : null,
    parent_id: respondentType === 'parent' ? body.respondentId : null,
    staff_id: respondentType === 'staff' ? body.respondentId : null,
    performed_by: auth.staffId,
    metadata: { form_id: form.id, form_name: form.name, form_response_id: response.id, recorded_on_behalf: true },
  });
  return NextResponse.json({ responseId: response.id });
}
