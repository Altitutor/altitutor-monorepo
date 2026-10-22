import { buildAnswerFilterQuestions, matchesAnswerFilters } from './answer-filters';

import { responses } from '../components/__tests__/answer-filter-fixtures';

it('selects whole responses by case-insensitive text on the specific question', () => {
  const question = buildAnswerFilterQuestions(responses).find((q) => q.title === 'How was it?')!;
  const matched = responses.filter((response) => matchesAnswerFilters(response, [{ questionKey: question.key, text: ' helpful ', values: [] }]));
  expect(matched.map((response) => response.id)).toEqual(['helpful']);
  expect(matched[0].form_response_answers?.map((answer) => answer.question_id)).toEqual(['q1', 'q2']);
});

it('shows subject names and matches ANY selected ID, with ALL question conditions', () => {
  const questions = buildAnswerFilterQuestions(responses);
  const subject = questions.find((q) => q.title === 'Subjects')!;
  const text = questions.find((q) => q.title === 'How was it?')!;
  expect(subject.options).toEqual([{ value: 'subject-uuid', label: 'Mathematics' }]);
  const filters = [{ questionKey: subject.key, text: '', values: ['another-subject', 'subject-uuid'] }];
  expect(responses.filter((row) => matchesAnswerFilters(row, filters)).map((row) => row.id)).toEqual(['helpful']);
  expect(matchesAnswerFilters(responses[0], [...filters, { questionKey: text.key, text: 'needs', values: [] }])).toBe(false);
});

it('does not confuse identical choice labels or a question copied into another form', () => {
  const copy = { ...responses[0], forms: { id: 'different-form', name: 'Another form' } };
  const original = buildAnswerFilterQuestions(responses).find((q) => q.title === 'Subjects')!;
  expect(matchesAnswerFilters(copy, [{ questionKey: original.key, text: '', values: ['subject-uuid'] }])).toBe(false);
  const differentEntity = { ...responses[0], form_response_answers: [{ ...responses[0].form_response_answers![1], choice_values: [{ value: 'different-uuid', label: 'Mathematics' }] }] };
  expect(matchesAnswerFilters(differentEntity, [{ questionKey: original.key, text: '', values: ['subject-uuid'] }])).toBe(false);
});

it('ignores empty conditions and excludes missing answers for active ones', () => {
  const question = buildAnswerFilterQuestions(responses).find((q) => q.title === 'Subjects')!;
  expect(matchesAnswerFilters(responses[1], [{ questionKey: question.key, text: ' ', values: [] }])).toBe(true);
  expect(matchesAnswerFilters(responses[1], [{ questionKey: question.key, text: '', values: ['subject-uuid'] }])).toBe(false);
});

it('groups compatible staff questions across versions but separates changed question definitions', () => {
  const staffQuestion = { id: 'staff-question', type: 'single_choice' as const, title: 'Who helped?', required: false, options: [], optionSource: { kind: 'model' as const, source: 'staff' as const } };
  const staffAnswer = { question_id: 'staff-question', question_label_snapshot: 'Who helped?', question_type: 'single_choice', choice_value: 'inactive-staff-id', choice_label_snapshot: 'Alice Tutor', choice_values: null, text_value: null, number_value: null };
  const old = { ...responses[0], form_versions: { version_number: 1, blocks: [staffQuestion] }, form_response_answers: [staffAnswer] };
  const current = { ...old, id: 'current', form_versions: { version_number: 2, blocks: [staffQuestion] } };
  const changed = { ...old, id: 'changed', form_versions: { version_number: 3, blocks: [{ ...staffQuestion, optionSource: { kind: 'model' as const, source: 'subjects' as const } }] } };
  const questions = buildAnswerFilterQuestions([old, current, changed]);
  expect(questions).toHaveLength(2);
  expect(questions[0].label).toContain('v1, v2');
  expect(questions[0].options).toEqual([{ value: 'inactive-staff-id', label: 'Alice Tutor' }]);
  const filters = [{ questionKey: questions[0].key, text: '', values: ['inactive-staff-id'] }];
  expect([old, current, changed].filter((row) => matchesAnswerFilters(row, filters)).map((row) => row.id)).toEqual(['helpful', 'current']);
});

it('supports editable text and choice operators without matching unanswered questions', () => {
  const questions = buildAnswerFilterQuestions(responses);
  const text = questions.find((question) => question.title === 'How was it?')!;
  const subject = questions.find((question) => question.title === 'Subjects')!;
  expect(responses.filter((row) => matchesAnswerFilters(row, [{ questionKey: text.key, text: 'helpful', values: [], operator: 'not_contains' }])).map((row) => row.id)).toEqual(['other']);
  expect(matchesAnswerFilters(responses[0], [{ questionKey: text.key, text: 'very helpful lesson', values: [], operator: 'equals' }])).toBe(true);
  expect(matchesAnswerFilters(responses[0], [{ questionKey: subject.key, text: '', values: ['subject-uuid', 'another-subject'], operator: 'all' }])).toBe(false);
  expect(matchesAnswerFilters(responses[0], [{ questionKey: subject.key, text: '', values: ['another-subject'], operator: 'none' }])).toBe(true);
  expect(matchesAnswerFilters(responses[1], [{ questionKey: subject.key, text: '', values: ['another-subject'], operator: 'none' }])).toBe(false);
});
