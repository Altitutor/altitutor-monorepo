'use client'

import {
  computeMaxRawScore,
  computeRawScore,
  scaleTo300_900,
} from '@altitutor/ucat-marking'
import type { QuestionMeta } from '@altitutor/ucat-marking'
import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/src/components/ucat/ucat-theme'
import type { QuestionItem } from '@/features/question-engine/model/types'

function truncateOneLine(text: string, maxLen = 60): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= maxLen) return t
  return t.slice(0, maxLen - 1) + '…'
}

export type MarkingRow = {
  question: QuestionItem
  index: number
  correctAnswerText: string
  studentAnswerText: string
  points: number
}

export type MarkingResult = {
  rows: MarkingRow[]
  totalRawScore: number
  maxRawScore: number
  scaledScore: number | null
}

function buildQuestionMeta(questions: QuestionItem[]): QuestionMeta[] {
  return questions.map((q) => ({
    id: q.id,
    stemId: q.stemId,
    sectionName: q.sectionName,
    questionType: q.questionType,
    correctOptionId: q.correctOptionId ?? '',
    options: q.options.map((o) => ({ id: o.id, index: o.index })),
  }))
}

export function computeMarkingResult(
  questions: QuestionItem[],
  selectedAnswers: Record<string, string>
): MarkingResult {
  const questionMeta = buildQuestionMeta(questions)
  const attempts = Object.entries(selectedAnswers)
    .filter(([, optId]) => optId != null)
    .map(([questionId, selectedOptionId]) => ({ questionId, selectedOptionId }))

  const { questionScores, totalRawScore } = computeRawScore({
    attempts,
    questions: questionMeta,
  })
  const maxRawScore = computeMaxRawScore(questionMeta)
  const scaledScore =
    maxRawScore > 0 ? scaleTo300_900(totalRawScore, maxRawScore) : null

  const optionByQuestionAndId = new Map<string, Map<string, string>>()
  for (const q of questions) {
    const map = new Map<string, string>()
    for (const opt of q.options) {
      map.set(opt.id, opt.text)
    }
    optionByQuestionAndId.set(q.id, map)
  }

  const rows: MarkingRow[] = questions.map((q, index) => {
    const optMap = optionByQuestionAndId.get(q.id)
    const correctText = q.correctOptionId
      ? (optMap?.get(q.correctOptionId) ?? '—')
      : '—'
    const selectedId = selectedAnswers[q.id]
    const studentText = selectedId ? (optMap?.get(selectedId) ?? '—') : '—'
    const points = questionScores.get(q.id) ?? 0

    return {
      question: q,
      index,
      correctAnswerText: correctText,
      studentAnswerText: studentText,
      points,
    }
  })

  return {
    rows,
    totalRawScore,
    maxRawScore,
    scaledScore,
  }
}

export function MarkingBody({
  result,
  onViewQuestion,
}: {
  result: MarkingResult
  onViewQuestion?: (index: number) => void
}) {
  const { rows, totalRawScore, maxRawScore, scaledScore } = result
  const rawPercent = maxRawScore > 0 ? (totalRawScore / maxRawScore) * 100 : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="shrink-0 p-4 border-b border-[#9ba9bd]"
        style={{ fontFamily: UCAT_FONTS.message }}
      >
        <div
          className="rounded-lg border border-[#9ba9bd] bg-white p-4 shadow-sm"
          style={{ fontSize: '12pt' }}
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>
              <strong>Raw score:</strong> {totalRawScore.toFixed(1)} / {maxRawScore}
            </span>
            {scaledScore != null && (
              <span>
                <strong>Scaled score:</strong> {scaledScore}
              </span>
            )}
          </div>
          <div className="mt-3">
            <div
              className="h-4 w-full overflow-hidden rounded-full bg-[#e8ecf0]"
              title={`${rawPercent.toFixed(0)}%`}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, rawPercent)}%`,
                  backgroundColor: UCAT_COLORS.primaryBlue,
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <table
          className="w-full border-collapse text-left"
          style={{ fontFamily: UCAT_FONTS.message, fontSize: '11pt' }}
        >
          <thead>
            <tr
              className="sticky top-0 z-10 text-white"
              style={{ backgroundColor: UCAT_COLORS.toolbarBlue }}
            >
              <th className="px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">Question</th>
              <th className="px-3 py-2 font-normal">Correct Answer</th>
              <th className="px-3 py-2 font-normal">Your Answer</th>
              <th className="px-3 py-2 font-normal text-right">Points</th>
              {onViewQuestion ? (
                <th className="px-3 py-2 font-normal">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const questionPreview = truncateOneLine(
                row.question.stemText && row.question.questionText
                  ? `${row.question.stemText} ${row.question.questionText}`
                  : row.question.questionText || row.question.stemText || '—',
                80
              )
              return (
                <tr
                  key={row.question.id}
                  className="border-b border-[#9ba9bd] hover:bg-[#fffd6f]/10"
                >
                  <td className="px-3 py-2">{row.index + 1}</td>
                  <td className="px-3 py-2 max-w-[200px]" title={questionPreview}>
                    {questionPreview}
                  </td>
                  <td className="px-3 py-2 max-w-[120px]" title={row.correctAnswerText}>
                    {truncateOneLine(row.correctAnswerText, 50)}
                  </td>
                  <td className="px-3 py-2 max-w-[120px]" title={row.studentAnswerText}>
                    {truncateOneLine(row.studentAnswerText, 50)}
                  </td>
                  <td className="px-3 py-2 text-right">{row.points.toFixed(1)}</td>
                  {onViewQuestion ? (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onViewQuestion(row.index)}
                        className="text-[#0066b3] hover:underline"
                      >
                        View question
                      </button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
