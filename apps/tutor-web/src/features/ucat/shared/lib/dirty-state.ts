import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from './rich-text'

export function snapshotSetDetail(value: {
  name: string
  description: string
  time: number | null
  isPrivate: boolean
  isStudentGenerated: boolean
  stemIds: string[]
}) {
  return JSON.stringify(value)
}

export function isSnapshotDirty(next: string, baseline: string) {
  return next !== baseline
}

/** Normalize ProseMirror JSON to plain text for semantic comparison. */
function jsonToPlainText(value: Json | null | undefined): string {
  if (value == null) return ''
  return proseMirrorToPlainText(value) ?? ''
}

/**
 * Snapshot of UcatQuestionStemFormValues with all ProseMirror JSON fields
 * converted to plain text for semantic dirty comparison.
 */
export function snapshotQuestionStemFormValues(values: {
  sectionId: string
  categoryId?: string | null
  stemText: Json
  isPrivate: boolean
  questions: Array<{
    questionText: Json
    questionType: string
    answerExplanation?: Json | null
    difficulty?: number | null
    timeBurdenSeconds?: string | null
    tagIds?: string[]
    options: Array<{
      answerText: Json
      answerExplanation?: Json | null
      isAnswer: boolean
    }>
  }>
}): string {
  const snapshot = {
    sectionId: values.sectionId,
    categoryId: values.categoryId ?? null,
    stemText: jsonToPlainText(values.stemText),
    isPrivate: values.isPrivate,
    questions: values.questions.map((q) => ({
      questionText: jsonToPlainText(q.questionText),
      questionType: q.questionType,
      answerExplanation: jsonToPlainText(q.answerExplanation ?? null),
      difficulty: q.difficulty ?? null,
      timeBurdenSeconds: q.timeBurdenSeconds ?? '',
      tagIds: [...(q.tagIds ?? [])].sort(),
      options: q.options.map((opt) => ({
        answerText: jsonToPlainText(opt.answerText),
        answerExplanation: jsonToPlainText(opt.answerExplanation ?? null),
        isAnswer: opt.isAnswer,
      })),
    })),
  }
  return JSON.stringify(snapshot)
}

/**
 * Snapshot for mock draft dirty check. Normalizes name and instructionsText
 * (ProseMirror JSON) to plain text for semantic comparison.
 */
export function snapshotMockDraft(value: {
  name: string | Json
  isPrivate: boolean
  setIds: string[]
  instructionsText: Json | null
}): string {
  const namePlain =
    typeof value.name === 'string' ? value.name : jsonToPlainText(value.name)
  return JSON.stringify({
    name: namePlain,
    isPrivate: value.isPrivate,
    setIds: value.setIds,
    instructionsText: jsonToPlainText(value.instructionsText),
  })
}
