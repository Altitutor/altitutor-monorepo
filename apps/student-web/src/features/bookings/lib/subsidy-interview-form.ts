import {
  normalizeFormAnswers,
  validateFormAnswers,
  type FormAnswerPayload,
  type FormBlock,
  type Json,
} from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { resolveFormBlocks } from '@/shared/lib/forms/resolve-form-blocks';

export const SUBSIDY_INTERVIEW_PURPOSE = 'subsidy_interview';

export type SubsidyInterviewForm = {
  id: string;
  name: string;
  versionId: string;
  blocks: FormBlock[];
  thankYouMessage: string;
};

type VersionRow = {
  id: string;
  blocks: unknown;
  thank_you_message: string | null;
};

function asBlocks(value: unknown): FormBlock[] {
  return Array.isArray(value) ? (value as FormBlock[]) : [];
}

export async function loadPublishedSubsidyInterviewForm(
  admin: SupabaseClient<Database>,
): Promise<SubsidyInterviewForm | null> {
  const { data, error } = await admin
    .from('forms')
    .select('id, name, latest_published_version_id, form_versions!forms_latest_published_version_id_fkey(id, blocks, thank_you_message)')
    .eq('purpose', SUBSIDY_INTERVIEW_PURPOSE)
    .eq('status', 'published')
    .is('archived_at', null)
    .not('latest_published_version_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.latest_published_version_id) return null;

  const version = data.form_versions as VersionRow | VersionRow[] | null;
  const published = Array.isArray(version) ? version[0] : version;
  if (!published?.id) return null;

  const blocks = await resolveFormBlocks(admin, asBlocks(published.blocks));
  return {
    id: data.id,
    name: data.name,
    versionId: published.id,
    blocks,
    thankYouMessage: published.thank_you_message ?? 'Thanks for your response.',
  };
}

export function subsidyFormValidationError(
  form: SubsidyInterviewForm | null,
  answers: FormAnswerPayload | null,
): string | null {
  if (!form) return null;
  if (!answers) return 'Complete the subsidy application before confirming.';
  const errors = validateFormAnswers(form.blocks, answers);
  return errors[0] ?? null;
}

export async function saveSubsidyInterviewResponse(
  admin: SupabaseClient<Database>,
  input: {
    form: SubsidyInterviewForm;
    answers: FormAnswerPayload;
    sessionId: string;
    studentId: string;
    submittedByUserId: string | null;
    respondentIsStudent: boolean;
  },
): Promise<void> {
  const normalized = normalizeFormAnswers(input.form.blocks, input.answers);
  const { data: response, error: responseError } = await admin
    .from('form_responses')
    .insert({
      form_id: input.form.id,
      form_version_id: input.form.versionId,
      session_id: input.sessionId,
      respondent_type: input.respondentIsStudent ? 'student' : 'anonymous',
      respondent_student_id: input.respondentIsStudent ? input.studentId : null,
      subject_type: 'student',
      subject_student_id: input.studentId,
      submitted_by_user_id: input.submittedByUserId,
      response_json: { answers: input.answers } as Json,
    })
    .select('id')
    .single();

  if (responseError || !response) {
    throw new Error(responseError?.message ?? 'Could not save the subsidy application.');
  }

  if (!normalized.length) return;
  const { error: answersError } = await admin.from('form_response_answers').insert(
    normalized.map((answer) => ({
      form_response_id: response.id,
      form_id: input.form.id,
      form_version_id: input.form.versionId,
      question_id: answer.questionId,
      question_label_snapshot: answer.questionLabelSnapshot,
      question_type: answer.questionType,
      choice_value: answer.choiceValue ?? null,
      choice_label_snapshot: answer.choiceLabelSnapshot ?? null,
      choice_values: (answer.choiceValues ?? null) as Json,
      text_value: answer.textValue ?? null,
      number_value: answer.numberValue ?? null,
    })),
  );
  if (answersError) throw new Error(answersError.message);
}
