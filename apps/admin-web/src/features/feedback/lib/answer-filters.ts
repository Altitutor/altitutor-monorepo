import { getFormQuestionReportingSignature, isQuestionBlock } from '@altitutor/shared';
import type { FormResponseAnswer, FormResponseDetail } from '../types';

export type AnswerFilter = { questionKey: string; text: string; values: string[]; operator?: 'contains' | 'equals' | 'not_contains' | 'any' | 'all' | 'none' };
export type AnswerFilterQuestion = {
  key: string;
  title: string;
  label: string;
  kind: 'text' | 'choice';
  options: Array<{ value: string; label: string }>;
};

function questionKey(response: FormResponseDetail, answer: FormResponseAnswer) {
  const block = response.form_versions?.blocks?.find((item) => item.id === answer.question_id);
  const signature = block && isQuestionBlock(block)
    ? getFormQuestionReportingSignature(block)
    : answer.question_type;
  return JSON.stringify([response.forms?.id ?? response.form_id, answer.question_id, signature]);
}

export function buildAnswerFilterQuestions(responses: FormResponseDetail[]): AnswerFilterQuestion[] {
  const questions = new Map<string, AnswerFilterQuestion>();
  const versions = new Map<string, Set<number>>();
  for (const response of responses) {
    for (const [index, answer] of (response.form_response_answers ?? []).entries()) {
      const kind = answer.question_type === 'single_choice' || answer.question_type === 'multi_select'
        ? 'choice'
        : answer.question_type === 'short_text' || answer.question_type === 'long_text' ? 'text' : null;
      if (!kind) continue;
      const key = questionKey(response, answer);
      let question = questions.get(key);
      if (!question) {
        const blocks = response.form_versions?.blocks?.filter(isQuestionBlock) ?? [];
        const position = blocks.findIndex((block) => block.id === answer.question_id);
        question = {
          key, title: answer.question_label_snapshot, kind, options: [],
          label: `${response.forms?.name ?? 'Form'} · Q${(position < 0 ? index : position) + 1}: ${answer.question_label_snapshot}`,
        };
        questions.set(key, question);
      }
      const version = response.form_versions?.version_number;
      if (version != null) {
        const numbers = versions.get(key) ?? new Set<number>();
        numbers.add(version);
        versions.set(key, numbers);
      }
      const choices = answer.question_type === 'single_choice' && answer.choice_value != null
        ? [{ value: answer.choice_value, label: answer.choice_label_snapshot }]
        : answer.choice_values ?? [];
      for (const choice of choices) {
        if (!question.options.some((option) => option.value === choice.value)) {
          const block = response.form_versions?.blocks?.find((item) => item.id === answer.question_id);
          const definitionLabel = block && 'options' in block
            ? block.options.find((option) => option.value === choice.value)?.label
            : undefined;
          question.options.push({ value: choice.value, label: choice.label?.trim() || definitionLabel || 'Unnamed option' });
        }
      }
    }
  }
  return [...questions.values()].map((question) => ({
    ...question,
    label: versions.has(question.key)
      ? `${question.label} · v${[...versions.get(question.key)!].sort((a, b) => a - b).join(', v')}`
      : question.label,
    options: question.options.sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

/** All question conditions must match; selected choices within a condition are alternatives. */
export function matchesAnswerFilters(response: FormResponseDetail, filters: AnswerFilter[]): boolean {
  return filters.every((filter) => {
    const text = filter.text.trim().toLowerCase();
    if (!text && !filter.values.length) return true;
    return (response.form_response_answers ?? []).some((answer) => {
      if (questionKey(response, answer) !== filter.questionKey) return false;
      if (filter.values.length) {
        const values = answer.question_type === 'single_choice'
          ? [answer.choice_value]
          : (answer.choice_values ?? []).map((choice) => choice.value);
        if (filter.operator === 'all') return filter.values.every((value) => values.includes(value));
        const includesAny = values.some((value) => value != null && filter.values.includes(value));
        return filter.operator === 'none' ? !includesAny : includesAny;
      }
      const value = (answer.text_value ?? '').toLowerCase();
      if (filter.operator === 'equals') return value.trim() === text;
      if (filter.operator === 'not_contains') return !value.includes(text);
      return value.includes(text);
    });
  });
}
