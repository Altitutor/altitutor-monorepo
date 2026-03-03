'use client'

import {
  computeMaxRawScore,
  computeRawScore,
  scaleTo300_900,
} from '@altitutor/ucat-marking'
import type { QuestionMeta } from '@altitutor/ucat-marking'
import { UCAT_COLORS, UCAT_FONTS } from '@altitutor/ui/src/components/ucat/ucat-theme'
import type { QuestionItem } from '@/features/question-engine/model/types'

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
  onNext,
}: {
  result: MarkingResult
  onNext: () => void
}) {
  const { rows, totalRawScore, maxRawScore, scaledScore } = result

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="shrink-0 p-4 border-b border-[#9ba9bd]"
        style={{ fontFamily: UCAT_FONTS.message, fontSize: '12pt' }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <strong>Raw score:</strong> {totalRawScore.toFixed(1)} / {maxRawScore}
          </span>
          {scaledScore != null && (
            <span>
              <strong>Scaled score:</strong> {scaledScore}
            </span>
          )}
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
              <th className="px-3 py-2 font-normal">Correct Answer</th>
              <th className="px-3 py-2 font-normal">Your Answer</th>
              <th className="px-3 py-2 font-normal text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.question.id}
                className="border-b border-[#9ba9bd] hover:bg-[#fffd6f]/10"
              >
                <td className="px-3 py-2">{row.index + 1}</td>
                <td className="px-3 py-2">{row.correctAnswerText}</td>
                <td className="px-3 py-2">{row.studentAnswerText}</td>
                <td className="px-3 py-2 text-right">{row.points.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="shrink-0 p-4 border-t border-[#9ba9bd] flex justify-end"
        style={{ fontFamily: UCAT_FONTS.message }}
      >
        <button
          type="button"
          onClick={onNext}
          className="px-4 py-2 text-white rounded"
          style={{ backgroundColor: UCAT_COLORS.primaryBlueDark }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
