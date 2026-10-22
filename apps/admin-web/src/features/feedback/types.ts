import type { FormAnswerPayload, FormBlock } from '@altitutor/shared';

export type Person = { id: string; first_name?: string | null; last_name?: string | null } | null | undefined;

export type FormResponseAnswer = {
  id?: string;
  question_id: string;
  question_label_snapshot: string;
  question_type: string;
  choice_value: string | null;
  choice_label_snapshot: string | null;
  choice_values: Array<{ value: string; label: string }> | null;
  text_value: string | null;
  number_value: number | null;
};

export type FormResponseDetail = {
  id: string;
  form_id?: string;
  respondent_type: string;
  subject_type: string;
  submitted_at: string;
  session_id?: string | null;
  forms?: { id?: string; name?: string | null; purpose?: string | null } | null;
  form_versions?: { id?: string; version_number?: number | null; blocks?: FormBlock[] } | null;
  response_json?: { answers?: FormAnswerPayload } | null;
  respondent_student?: Person;
  respondent_staff?: Person;
  respondent_parent?: Person;
  recorded_by_staff?: Person;
  sessions?: { id: string; start_at?: string | null; short_name?: string | null; long_name?: string | null } | null;
  subject_student?: Person;
  subject_staff?: Person;
  subject_parent?: Person;
  form_response_answers?: FormResponseAnswer[];
};

