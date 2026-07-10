import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

export async function GET(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const formId = searchParams.get('formId');
  const versionId = searchParams.get('versionId');
  if (!formId) {
    return NextResponse.json({ error: 'formId is required' }, { status: 400 });
  }

  const admin = auth.admin as any;
  const { data: form, error: formError } = await admin
    .from('forms')
    .select('id, name, latest_published_version_id')
    .eq('id', formId)
    .single();
  if (formError || !form) {
    return NextResponse.json({ error: formError?.message ?? 'Form not found' }, { status: 404 });
  }

  const selectedVersionId = versionId ?? form.latest_published_version_id;
  if (!selectedVersionId) {
    return NextResponse.json({ report: null });
  }

  const [{ data: version }, { data: responses }, { count }] = await Promise.all([
    admin.from('form_versions').select('*').eq('id', selectedVersionId).single(),
    admin
      .from('form_responses')
      .select(`
        id,
        session_id,
        respondent_type,
        subject_type,
        submitted_at,
        respondent_student:students!form_responses_respondent_student_id_fkey ( id, first_name, last_name ),
        respondent_staff:staff!form_responses_respondent_staff_id_fkey ( id, first_name, last_name ),
        respondent_parent:parents!form_responses_respondent_parent_id_fkey ( id, first_name, last_name ),
        subject_student:students!form_responses_subject_student_id_fkey ( id, first_name, last_name ),
        subject_staff:staff!form_responses_subject_staff_id_fkey ( id, first_name, last_name ),
        subject_parent:parents!form_responses_subject_parent_id_fkey ( id, first_name, last_name ),
        form_response_answers ( id, question_id, question_label_snapshot, question_type, choice_value, choice_label_snapshot, choice_values, text_value, number_value, created_at )
      `)
      .eq('form_version_id', selectedVersionId)
      .is('deleted_at', null)
      .order('submitted_at', { ascending: false }),
    admin
      .from('form_responses')
      .select('id', { count: 'exact', head: true })
      .eq('form_version_id', selectedVersionId)
      .is('deleted_at', null),
  ]);

  return NextResponse.json({
    report: {
      form,
      version,
      responseCount: count ?? 0,
      responses: responses ?? [],
      answers: (responses ?? []).flatMap((response: any) =>
        (response.form_response_answers ?? []).map((answer: any) => ({
          ...answer,
          response,
        }))
      ),
    },
  });
}
