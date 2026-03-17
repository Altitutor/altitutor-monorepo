'use client'

import { SCALED_MAX, SITUATIONAL_JUDGEMENT_SECTION_NAME } from '@altitutor/ucat-marking'
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import { UCAT_FONTS } from '@altitutor/ui/src/components/ucat/ucat-theme'
import type { QuestionEngineExam, QuestionItem } from '@/features/question-engine/model/types'
import {
  computeMarkingResult,
  MarkingBody,
  type MarkingResult,
} from '@/features/question-engine/components/marking-body'

type MockScoreBodyProps = {
  exam: QuestionEngineExam
  questions: QuestionItem[]
  selectedAnswers: Record<string, string>
  syllogismSnapshots?: Record<string, Record<string, boolean>>
  onViewQuestion?: (globalIndex: number) => void
}

export function MockScoreBody({
  exam,
  questions,
  selectedAnswers,
  syllogismSnapshots,
  onViewQuestion,
}: MockScoreBodyProps) {
  const summaries = exam.mockSetSummaries ?? []
  if (summaries.length === 0) return null

  // Exclude Section 4 (Situational Judgement) from mock score
  const scoredSummaries = summaries.filter((summary) => {
    const firstQuestion = questions[summary.questionStartIndex]
    return firstQuestion?.sectionName !== SITUATIONAL_JUDGEMENT_SECTION_NAME
  })

  const setResults: Array<{ summary: (typeof summaries)[0]; result: MarkingResult }> = []
  let totalRawScore = 0
  let maxRawScore = 0
  let totalScaledScore = 0
  let scaledCount = 0

  for (const summary of scoredSummaries) {
    const setQuestions = questions.slice(summary.questionStartIndex, summary.questionEndIndex)
    const result = computeMarkingResult(setQuestions, selectedAnswers, syllogismSnapshots)
    setResults.push({ summary, result })
    totalRawScore += result.totalRawScore
    maxRawScore += result.maxRawScore
    if (result.scaledScore != null) {
      totalScaledScore += result.scaledScore
      scaledCount += 1
    }
  }

  const totalScaled = scaledCount > 0 ? totalScaledScore : null
  const maxScaled = scoredSummaries.length > 0 ? scoredSummaries.length * SCALED_MAX : 0

  return (
    <div className="flex flex-col h-full overflow-hidden gap-6 p-4" style={{ fontFamily: UCAT_FONTS.message }}>
      <div
        className="shrink-0 rounded-lg border border-[#9ba9bd] bg-white p-4 shadow-sm"
        style={{ fontSize: '12pt' }}
      >
        <div className="text-lg font-semibold">Overall mock score</div>
        <div className="mt-2 flex items-baseline gap-4">
          <span>
            <strong>Raw score:</strong> {totalRawScore.toFixed(1)} / {maxRawScore}
          </span>
          {totalScaled != null && maxScaled > 0 && (
            <span>
              <strong>Scaled score:</strong> {Math.round(totalScaled)} / {maxScaled}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto space-y-6">
        {setResults.map(({ summary, result }) => (
          <Card key={summary.setIndex} className="rounded-xl border-border overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">{summary.name}</CardTitle>
              <div className="text-sm text-muted-foreground">
                {result.totalRawScore.toFixed(1)} / {result.maxRawScore} points
                {result.scaledScore != null && (
                  <span className="ml-2">Scaled: {Math.round(result.scaledScore)}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <MarkingBody
                  result={result}
                  syllogismSnapshots={syllogismSnapshots}
                  hideHeader
                  onViewQuestion={
                    onViewQuestion
                      ? (localIndex) =>
                          onViewQuestion(summary.questionStartIndex + localIndex)
                      : undefined
                  }
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
