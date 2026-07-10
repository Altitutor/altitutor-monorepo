import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

export async function GET(request: Request) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const formId = searchParams.get('formId');
  const admin = auth.admin as any;

  let query = admin
    .from('form_responses')
    .select(`
      *,
      forms ( id, name, purpose ),
      form_versions ( id, version_number ),
      respondent_student:students!form_responses_respondent_student_id_fkey ( id, first_name, last_name ),
      respondent_staff:staff!form_responses_respondent_staff_id_fkey ( id, first_name, last_name ),
      respondent_parent:parents!form_responses_respondent_parent_id_fkey ( id, first_name, last_name ),
      subject_student:students!form_responses_subject_student_id_fkey ( id, first_name, last_name ),
      subject_staff:staff!form_responses_subject_staff_id_fkey ( id, first_name, last_name ),
      subject_parent:parents!form_responses_subject_parent_id_fkey ( id, first_name, last_name ),
      form_response_answers ( id, question_id, question_label_snapshot, question_type, choice_value, choice_label_snapshot, choice_values, text_value, number_value )
    `)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })
    .limit(500);

  if (formId) query = query.eq('form_id', formId);
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ responses: data ?? [] });
}
