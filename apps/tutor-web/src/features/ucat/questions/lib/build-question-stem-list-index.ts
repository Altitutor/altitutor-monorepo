import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type UcatQuestionStemListIndex = {
  tagIds: Record<string, string[]>
  searchTexts: Record<string, { questionText: string; answerOptionText: string }>
}

type DetailQuestion = {
  deleted_at?: string | null
  question_text?: Json | null
  tags?: Array<{ id?: string | null }> | null
  answer_options?: Array<{
    deleted_at?: string | null
    answer_text?: Json | null
  }> | null
}

type DetailRow = {
  id: string | null
  questions: unknown
}

/** Derive list-index maps from one `vtutor_ucat_question_stem_detail` payload. */
export function buildQuestionStemListIndex(rows: DetailRow[]): UcatQuestionStemListIndex {
  const tagIds: Record<string, string[]> = {}
  const searchTexts: Record<string, { questionText: string; answerOptionText: string }> = {}

  for (const row of rows) {
    if (!row.id) continue

    const questions = Array.isArray(row.questions) ? (row.questions as DetailQuestion[]) : []
    const tagIdSet = new Set<string>()
    const questionTexts: string[] = []
    const answerOptionTexts: string[] = []

    for (const question of questions) {
      if (question.deleted_at) continue

      const tags = Array.isArray(question.tags) ? question.tags : []
      for (const tag of tags) {
        if (tag.id) tagIdSet.add(tag.id)
      }

      const questionText = proseMirrorToPlainText(question.question_text)
      if (questionText) questionTexts.push(questionText)

      const answerOptions = Array.isArray(question.answer_options) ? question.answer_options : []
      for (const option of answerOptions) {
        if (option.deleted_at) continue
        const answerText = proseMirrorToPlainText(option.answer_text)
        if (answerText) answerOptionTexts.push(answerText)
      }
    }

    tagIds[row.id] = Array.from(tagIdSet)
    searchTexts[row.id] = {
      questionText: questionTexts.join(' '),
      answerOptionText: answerOptionTexts.join(' '),
    }
  }

  return { tagIds, searchTexts }
}
