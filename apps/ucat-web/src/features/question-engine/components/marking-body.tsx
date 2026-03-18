'use client'

import {
  computeMaxRawScore,
  computeRawScore,
  scaleTo300_900,
} from '@altitutor/ucat-marking'
import type { QuestionMeta } from '@altitutor/ucat-marking'
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import { cn } from '@/lib/utils'
import type { QuestionItem } from '@/features/question-engine/model/types'

function CircularProgress({
  percentage,
  label,
  size = 120,
  strokeWidth = 10,
  className,
}: {
  percentage: number
  label: React.ReactNode
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2',
        className
      )}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          aria-label={`${percentage}% progress`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-accent transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold tabular-nums">
            {percentage}%
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {label}
      </span>
    </div>
  )
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
  selectedAnswers: Record<string, string>,
  syllogismSnapshots?: Record<string, Record<string, boolean>>
): MarkingResult {
  const questionMeta = buildQuestionMeta(questions)

  // Non-syllogism questions scored via shared marking package
  const nonSyllogismMeta = questionMeta.filter((q) => q.questionType !== 'syllogism')
  const nonSyllogismIds = new Set(nonSyllogismMeta.map((q) => q.id))

  const attempts = Object.entries(selectedAnswers)
    .filter(([questionId]) => nonSyllogismIds.has(questionId) && selectedAnswers[questionId])
    .map(([questionId, selectedOptionId]) => ({ questionId, selectedOptionId }))

  const base = computeRawScore({
    attempts,
    questions: nonSyllogismMeta,
  })

  const questionScores = new Map(base.questionScores)

  // Syllogism questions: score from snapshots against option.isAnswer flags
  for (const q of questions) {
    if (q.questionType !== 'syllogism') continue

    const snapshot = syllogismSnapshots?.[q.id]
    if (!snapshot) {
      questionScores.set(q.id, 0)
      continue
    }

    const optionsSorted = [...q.options].sort((a, b) => a.index - b.index)
    let correctCount = 0
    for (const opt of optionsSorted) {
      const student = snapshot[opt.id]
      const correctYes = opt.isAnswer === true
      if (student === undefined) {
        // treat unanswered as incorrect
        continue
      }
      if (student === correctYes) {
        correctCount += 1
      }
    }

    let stemPoints = 0
    if (correctCount >= 5) {
      stemPoints = 2
    } else if (correctCount >= 3) {
      stemPoints = 1
    } else {
      stemPoints = 0
    }

    questionScores.set(q.id, stemPoints)
  }

  const totalRawScore = Array.from(questionScores.values()).reduce(
    (sum, s) => sum + s,
    0
  )

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
  syllogismSnapshots,
  hideHeader = false,
  backHref,
  backLabel,
  viewReportHref,
}: {
  result: MarkingResult
  onViewQuestion?: (index: number) => void
  syllogismSnapshots?: Record<string, Record<string, boolean>>
  /** When true, omit the score header (e.g. when embedded in a card with its own header). */
  hideHeader?: boolean
  /** When provided, show "Back to sets/mocks" button below score. */
  backHref?: string
  backLabel?: string
  /** When provided, show "View performance report" button below score. */
  viewReportHref?: string
}) {
  const { rows, totalRawScore, maxRawScore, scaledScore } = result
  const isSummaryView = backHref != null || viewReportHref != null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {!hideHeader && (
        <div className="shrink-0 p-4 flex flex-col items-center">
          <div className="flex flex-wrap gap-4 justify-center">
            <Card className="rounded-xl border-border max-w-[200px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Score</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="text-3xl font-bold tabular-nums">
                  {totalRawScore.toFixed(1)} / {maxRawScore.toFixed(1)}
                </div>
                <CircularProgress
                  percentage={
                    maxRawScore > 0
                      ? Math.round((totalRawScore / maxRawScore) * 100)
                      : 0
                  }
                  label={`${totalRawScore.toFixed(1)} / ${maxRawScore.toFixed(1)} points`}
                  className="text-accent"
                />
              </CardContent>
            </Card>
            {scaledScore != null && (
              <Card className="rounded-xl border-border max-w-[200px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">
                    Scaled score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={cn(
                      'text-3xl font-bold tabular-nums',
                      scaledScore == null && 'text-muted-foreground'
                    )}
                  >
                    {Math.round(scaledScore)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          {(backHref != null || viewReportHref != null) && (
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              {backHref != null && (
                <a
                  href={backHref}
                  data-skip-leave-warning
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-muted hover:text-muted-foreground"
                >
                  {backLabel ?? 'Back'}
                </a>
              )}
              {viewReportHref != null && (
                <a
                  href={viewReportHref}
                  data-skip-leave-warning
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground hover:bg-sidebar/90"
                >
                  View performance report
                </a>
              )}
            </div>
          )}
        </div>
      )}
      {!isSummaryView && (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
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
                const questionPreview = (row.question.stemText && row.question.questionText
                  ? `${row.question.stemText} ${row.question.questionText}`
                  : row.question.questionText || row.question.stemText || '—'
                ).replace(/\s+/g, ' ').trim()
                const truncate = (t: string, max = 60) =>
                  t.length <= max ? t : t.slice(0, max - 1) + '…'

                let correctDisplay = row.correctAnswerText
                let studentDisplay = row.studentAnswerText

                if (row.question.questionType === 'syllogism') {
                  const options = [...row.question.options].sort(
                    (a, b) => a.index - b.index
                  )
                  const snapshot = syllogismSnapshots?.[row.question.id] ?? {}
                  correctDisplay = options
                    .map((opt) => (opt.isAnswer ? 'Y' : 'N'))
                    .join('')
                  studentDisplay = options
                    .map((opt) =>
                      snapshot[opt.id] === true
                        ? 'Y'
                        : snapshot[opt.id] === false
                          ? 'N'
                          : '-'
                    )
                    .join('')
                }

                return (
                  <tr
                    key={row.question.id}
                    className="border-b border-border/50 hover:bg-muted/50"
                  >
                    <td className="px-3 py-2">{row.index + 1}</td>
                    <td className="px-3 py-2 max-w-[200px]" title={questionPreview}>
                      {truncate(questionPreview, 80)}
                    </td>
                    <td className="px-3 py-2 max-w-[120px]" title={correctDisplay}>
                      {truncate(correctDisplay, 50)}
                    </td>
                    <td className="px-3 py-2 max-w-[120px]" title={studentDisplay}>
                      {truncate(studentDisplay, 50)}
                    </td>
                    <td className="px-3 py-2 text-right">{row.points.toFixed(1)}</td>
                    {onViewQuestion ? (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onViewQuestion(row.index)}
                          className="text-primary hover:underline"
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
      )}
    </div>
  )
}
