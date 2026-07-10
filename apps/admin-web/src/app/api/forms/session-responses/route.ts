import { NextResponse } from 'next/server';
import { normalizeFormAnswers, validateFormAnswers } from '@altitutor/shared';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

export async function GET(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  const admin = auth.admin as any;
  const [{ data: students }, { data: staff }, { data: forms }] = await Promise.all([
    admin.from('sessions_students').select('student:students(id, first_name, last_name)').eq('session_id', sessionId),
    admin.from('sessions_staff').select('staff:staff(id, first_name, last_name)').eq('session_id', sessionId),
    admin.from('forms').select('id, name, purpose, latest_published_version_id, form_versions!forms_latest_published_version_id_fkey(id, version_number, blocks, thank_you_message)')
      .eq('status', 'published').is('archived_at', null).in('purpose', ['check_in', 'feedback']),
  ]);
  const studentRows = (students ?? []).flatMap((row: any) => row.student ? [row.student] : []);
  const parentIds = studentRows.map((student: any) => student.id);
  const { data: parentLinks } = parentIds.length
    ? await admin.from('parents_students').select('parent:parents(id, first_name, last_name)').in('student_id', parentIds)
    : { data: [] };
  return NextResponse.json({
    participants: [
      ...studentRows.map((person: any) => ({ ...person, type: 'student' })),
      ...(staff ?? []).flatMap((row: any) => row.staff ? [{ ...row.staff, type: 'staff' }] : []),
      ...(parentLinks ?? []).flatMap((row: any) => row.parent ? [{ ...row.parent, type: 'parent' }] : []),
    ],
    forms: forms ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null) as any;
  if (!body?.sessionId || !body?.formId || !body?.subjectId || !['student', 'staff', 'parent'].includes(body.subjectType)) {
    return NextResponse.json({ error: 'Session, form and participant are required.' }, { status: 400 });
  }
  const admin = auth.admin as any;
  const { data: form } = await admin.from('forms')
    .select('id, latest_published_version_id, form_versions!forms_latest_published_version_id_fkey(id, blocks)')
    .eq('id', body.formId).eq('status', 'published').is('archived_at', null).maybeSingle();
  const version = (form as any)?.form_versions;
  if (!form?.latest_published_version_id || !version) return NextResponse.json({ error: 'Select a published form.' }, { status: 409 });
  const errors = validateFormAnswers(version.blocks ?? [], body.answers ?? {});
  if (errors.length) return NextResponse.json({ error: errors.join(' ') }, { status: 400 });
  const { data: response, error } = await admin.from('form_responses').insert({
    form_id: form.id, form_version_id: form.latest_published_version_id, session_id: body.sessionId,
    respondent_type: 'staff', respondent_staff_id: auth.staffId,
    subject_type: body.subjectType, [`subject_${body.subjectType}_id`]: body.subjectId,
    response_json: { answers: body.answers ?? {} },
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const answers = normalizeFormAnswers(version.blocks ?? [], body.answers ?? {}).map((answer) => ({
    form_response_id: response.id, form_id: form.id, form_version_id: form.latest_published_version_id,
    question_id: answer.questionId, question_label_snapshot: answer.questionLabelSnapshot, question_type: answer.questionType,
    choice_value: answer.choiceValue ?? null, choice_label_snapshot: answer.choiceLabelSnapshot ?? null,
    choice_values: answer.choiceValues ?? null, text_value: answer.textValue ?? null, number_value: answer.numberValue ?? null,
  }));
  if (answers.length) {
    const { error: answerError } = await admin.from('form_response_answers').insert(answers);
    if (answerError) return NextResponse.json({ error: answerError.message }, { status: 500 });
  }
  await admin.from('activity_events').insert({
    entity_type: 'form_responses', entity_id: response.id, event_type: 'CREATED', session_id: body.sessionId,
    student_id: body.subjectType === 'student' ? body.subjectId : null,
    staff_id: body.subjectType === 'staff' ? body.subjectId : null,
    parent_id: body.subjectType === 'parent' ? body.subjectId : null,
    performed_by: auth.staffId, metadata: { form_response_id: response.id, form_id: form.id },
  });
  return NextResponse.json({ responseId: response.id });
}
