import type { Json, UcatSkillTrainerKey } from '@altitutor/shared'
import type { UcatSkillTrainerItemRow } from '@/features/ucat/skill-trainer/api/items'
import {
  defaultContentForTrainerKey,
  EMPTY_DOC,
} from '@/features/ucat/skill-trainer/constants/itemFormConstants'
import type { UcatSkillTrainerItemFormValues } from '@/features/ucat/skill-trainer/types/schema'
import { hasRichTextContent, plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function mapRowToFormValues(row: UcatSkillTrainerItemRow): UcatSkillTrainerItemFormValues {
  const content = asRecord(row.content)
  const key = row.trainer_key as UcatSkillTrainerKey

  const base = {
    skillTrainerId: row.skill_trainer_id,
    trainerKey: key,
    isActive: row.is_active,
  }

  switch (key) {
    case 'find_word':
      return {
        ...base,
        passage: asRecord(content.passage),
        keywords: Array.isArray(content.keywords)
          ? (content.keywords as UcatSkillTrainerItemFormValues['keywords'])
          : [],
      }
    case 'find_concept':
      return {
        ...base,
        passage: asRecord(content.passage),
        concept: typeof content.concept === 'string' ? content.concept : '',
        occurrences: Array.isArray(content.occurrences)
          ? (content.occurrences as UcatSkillTrainerItemFormValues['occurrences'])
          : [],
      }
    case 'quick_syllogism':
      return {
        ...base,
        statement: typeof content.statement === 'string' ? content.statement : '',
        syllogismAnswer: typeof content.answer === 'boolean' ? content.answer : true,
      }
    case 'mental_maths':
      return {
        ...base,
        expression: typeof content.expression === 'string' ? content.expression : '',
        answer: typeof content.answer === 'number' ? content.answer : 0,
      }
    case 'numpad_speed':
      return {
        ...base,
        buttonSequence: Array.isArray(content.button_sequence)
          ? content.button_sequence.filter((v): v is string => typeof v === 'string')
          : [],
        label: typeof content.label === 'string' ? content.label : '',
      }
    case 'calculator_maths': {
      const expression = typeof content.expression === 'string' ? content.expression : ''
      const questionJson =
        content.question && typeof content.question === 'object' && !Array.isArray(content.question)
          ? (content.question as Json)
          : null
      const question =
        questionJson && hasRichTextContent(questionJson)
          ? asRecord(questionJson)
          : expression
            ? asRecord(plainTextToProseMirror(expression))
            : asRecord(EMPTY_DOC)
      return {
        ...base,
        question,
        expression,
        answer: typeof content.answer === 'number' ? content.answer : 0,
      }
    }
  }
}

export function createEmptyFormValues(
  skillTrainerId: string,
  trainerKey: UcatSkillTrainerKey
): UcatSkillTrainerItemFormValues {
  const content = defaultContentForTrainerKey(trainerKey)
  const row = {
    id: '',
    skill_trainer_id: skillTrainerId,
    trainer_key: trainerKey,
    trainer_name: '',
    content,
    is_active: true,
    approval_status: 'pending' as const,
    source_question_stem_id: null,
    updated_at: new Date().toISOString(),
  }
  return mapRowToFormValues(row)
}

export function mapFormValuesToContent(values: UcatSkillTrainerItemFormValues): Record<string, unknown> {
  switch (values.trainerKey) {
    case 'find_word':
      return {
        passage: values.passage ?? EMPTY_DOC,
        keywords: values.keywords ?? [],
      }
    case 'find_concept':
      return {
        passage: values.passage ?? EMPTY_DOC,
        concept: values.concept ?? '',
        occurrences: values.occurrences ?? [],
      }
    case 'quick_syllogism':
      return {
        statement: values.statement ?? '',
        answer: values.syllogismAnswer ?? true,
      }
    case 'mental_maths':
      return {
        expression: values.expression ?? '',
        answer: values.answer ?? 0,
      }
    case 'numpad_speed':
      return {
        button_sequence: values.buttonSequence ?? [],
        ...(values.label?.trim() ? { label: values.label.trim() } : {}),
      }
    case 'calculator_maths': {
      const question = (values.question ?? EMPTY_DOC) as Json
      const hasQuestion = hasRichTextContent(question)
      return {
        answer: values.answer ?? 0,
        ...(hasQuestion ? { question } : {}),
        ...(values.expression?.trim() && !hasQuestion
          ? { expression: values.expression.trim() }
          : {}),
      }
    }
  }
}

export function snapshotSkillTrainerItemFormValues(values: UcatSkillTrainerItemFormValues): string {
  return JSON.stringify(values)
}
