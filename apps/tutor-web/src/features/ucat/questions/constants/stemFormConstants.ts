import type { Json } from '@altitutor/shared'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'

export const EMPTY_DOC: Json = plainTextToProseMirror('')

export const DEFAULT_OPTIONS = [
  { answerText: EMPTY_DOC, answerExplanation: null, answerKeyValue: 'correct' as const },
  { answerText: EMPTY_DOC, answerExplanation: null, answerKeyValue: null },
  { answerText: EMPTY_DOC, answerExplanation: null, answerKeyValue: null },
  { answerText: EMPTY_DOC, answerExplanation: null, answerKeyValue: null },
]
