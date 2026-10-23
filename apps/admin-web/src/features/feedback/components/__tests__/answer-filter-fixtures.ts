import type { FormResponseDetail } from '../../types';

export const responses: FormResponseDetail[] = [
  {
    id: 'helpful', respondent_type: 'student', subject_type: 'none', submitted_at: '2026-10-22',
    forms: { id: 'feedback', name: 'Student feedback' },
    form_response_answers: [
      { question_id: 'q1', question_label_snapshot: 'How was it?', question_type: 'long_text', text_value: 'Very HELPFUL lesson', choice_value: null, choice_label_snapshot: null, choice_values: null, number_value: null },
      { question_id: 'q2', question_label_snapshot: 'Subjects', question_type: 'multi_select', text_value: null, choice_value: null, choice_label_snapshot: null, choice_values: [{ value: 'subject-uuid', label: 'Mathematics' }], number_value: null },
    ],
  },
  {
    id: 'other', respondent_type: 'student', subject_type: 'none', submitted_at: '2026-10-21',
    forms: { id: 'feedback', name: 'Student feedback' },
    form_response_answers: [
      { question_id: 'q1', question_label_snapshot: 'How was it?', question_type: 'long_text', text_value: 'Needs work', choice_value: null, choice_label_snapshot: null, choice_values: null, number_value: null },
    ],
  },
];
