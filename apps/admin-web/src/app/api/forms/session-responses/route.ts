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

type PersonRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type SessionParticipantBody = {
  sessionId?: string;
  formId?: string;
  subjectId?: string;
  subjectType?: 'student' | 'staff' | 'parent';
  answers?: unknown;
};

type FormWithVersion = {
  id: string;
  latest_published_version_id: string | null;
  form_versions: { id: string; blocks: unknown } | { id: string; blocks: unknown }[] | null;
};

function asFormBlocks(value: unknown): FormBlock[] {
  return Array.isArray(value) ? (value as FormBlock[]) : [];
}

function asFormAnswers(value: unknown): FormAnswerPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as FormAnswerPayload;
}

function asPerson(value: unknown): PersonRow | null {
  if (!value || typeof value !== 'object') return null;
  const person = value as Partial<PersonRow>;
  if (typeof person.id !== 'string') return null;
  return {
    id: person.id,
    first_name: typeof person.first_name === 'string' ? person.first_name : null,
    last_name: typeof person.last_name === 'string' ? person.last_name : null,
  };
}

function resolveVersion(form: FormWithVersion | null): { id: string; blocks: unknown } | null {
  if (!form?.form_versions) return null;
  return Array.isArray(form.form_versions) ? form.form_versions[0] ?? null : form.form_versions;
}

export async function GET(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  const admin = auth.admin;
  const [{ data: students }, { data: staff }, { data: forms }] = await Promise.all([
    admin.from('sessions_students').select('student:students(id, first_name, last_name)').eq('session_id', sessionId),
    admin.from('sessions_staff').select('staff:staff(id, first_name, last_name)').eq('session_id', sessionId),
    admin.from('forms').select('id, name, purpose, latest_published_version_id, form_versions!forms_latest_published_version_id_fkey(id, version_number, blocks, thank_you_message)')
      .eq('status', 'published').is('archived_at', null).in('purpose', ['check_in', 'feedback']),
  ]);
  const studentRows = (students ?? [])
    .map((row) => asPerson(row.student))
    .filter((person): person is PersonRow => person !== null);
  const parentIds = studentRows.map((student) => student.id);
  const { data: parentLinks } = parentIds.length
    ? await admin.from('parents_students').select('parent:parents(id, first_name, last_name)').in('student_id', parentIds)
    : { data: [] as Array<{ parent: unknown }> };
  return NextResponse.json({
    participants: [
      ...studentRows.map((person) => ({ ...person, type: 'student' as const })),
      ...(staff ?? [])
        .map((row) => asPerson(row.staff))
        .filter((person): person is PersonRow => person !== null)
        .map((person) => ({ ...person, type: 'staff' as const })),
      ...(parentLinks ?? [])
        .map((row) => asPerson(row.parent))
        .filter((person): person is PersonRow => person !== null)
        .map((person) => ({ ...person, type: 'parent' as const })),
    ],
    forms: forms ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null) as SessionParticipantBody | null;
  if (!body?.sessionId || !body?.formId || !body?.subjectId || !['student', 'staff', 'parent'].includes(body.subjectType ?? '')) {
    return NextResponse.json({ error: 'Session, form and participant are required.' }, { status: 400 });
  }
  const subjectType = body.subjectType!;
  const admin = auth.admin;
  const { data: formData } = await admin.from('forms')
    .select('id, latest_published_version_id, form_versions!forms_latest_published_version_id_fkey(id, blocks)')
    .eq('id', body.formId).eq('status', 'published').is('archived_at', null).maybeSingle();
  const form = formData as FormWithVersion | null;
  const version = resolveVersion(form);
  if (!form?.latest_published_version_id || !version) return NextResponse.json({ error: 'Select a published form.' }, { status: 409 });
  const versionId = form.latest_published_version_id;
  const answerPayload = asFormAnswers(body.answers);
  const blocks = asFormBlocks(version.blocks);
  const errors = validateFormAnswers(blocks, answerPayload);
  if (errors.length) return NextResponse.json({ error: errors.join(' ') }, { status: 400 });

  const insertPayload: TablesInsert<'form_responses'> = {
    form_id: form.id,
    form_version_id: versionId,
    session_id: body.sessionId,
    respondent_type: 'staff',
    respondent_staff_id: auth.staffId,
    subject_type: subjectType,
    response_json: { answers: answerPayload } as Json,
    subject_student_id: subjectType === 'student' ? body.subjectId : null,
    subject_staff_id: subjectType === 'staff' ? body.subjectId : null,
    subject_parent_id: subjectType === 'parent' ? body.subjectId : null,
  };

  const { data: response, error } = await admin.from('form_responses').insert(insertPayload).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const answers = normalizeFormAnswers(blocks, answerPayload).map((answer) => ({
    form_response_id: response.id,
    form_id: form.id,
    form_version_id: versionId,
    question_id: answer.questionId,
    question_label_snapshot: answer.questionLabelSnapshot,
    question_type: answer.questionType,
    choice_value: answer.choiceValue ?? null,
    choice_label_snapshot: answer.choiceLabelSnapshot ?? null,
    choice_values: (answer.choiceValues ?? null) as Json,
    text_value: answer.textValue ?? null,
    number_value: answer.numberValue ?? null,
  }));
  if (answers.length) {
    const { error: answerError } = await admin.from('form_response_answers').insert(answers);
    if (answerError) return NextResponse.json({ error: answerError.message }, { status: 500 });
  }
  await admin.from('activity_events').insert({
    entity_type: 'form_responses', entity_id: response.id, event_type: 'CREATED', session_id: body.sessionId,
    student_id: subjectType === 'student' ? body.subjectId : null,
    staff_id: subjectType === 'staff' ? body.subjectId : null,
    parent_id: subjectType === 'parent' ? body.subjectId : null,
    performed_by: auth.staffId, metadata: { form_response_id: response.id, form_id: form.id },
  });
  return NextResponse.json({ responseId: response.id });
}
