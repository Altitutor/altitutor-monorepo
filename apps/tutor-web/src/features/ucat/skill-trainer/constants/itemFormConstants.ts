import type { Json, UcatSkillTrainerKey } from '@altitutor/shared'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'

export const EMPTY_DOC: Json = plainTextToProseMirror('')

export function defaultContentForTrainerKey(key: UcatSkillTrainerKey): Record<string, unknown> {
  switch (key) {
    case 'find_word':
      return {
        passage: EMPTY_DOC,
        keywords: [{ id: 'k1', text: 'keyword', target_sentence_index: 0 }],
      }
    case 'find_concept':
      return {
        passage: EMPTY_DOC,
        concept: 'theme',
        occurrences: [{ start: 0, end: 5 }],
      }
    case 'quick_syllogism':
      return { statement: 'All A are B.', answer: true }
    case 'mental_maths':
      return { expression: '12 + 8', answer: 20 }
    case 'numpad_speed':
      return { button_sequence: ['7', '+', '3'], label: '7 + 3' }
    case 'calculator_maths':
      return { question: EMPTY_DOC, answer: 60 }
  }
}
