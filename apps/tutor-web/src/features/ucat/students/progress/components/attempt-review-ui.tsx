'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Flag, Info } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SegmentedControl,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui'
import { UcatRichContentBlock } from '@/features/ucat/question-engine-preview/UcatRichContentBlock'
import { tutorBtnIconOutline, tutorCardCn } from '@/shared/lib/tutor-visual'
import { cn } from '@/shared/utils'
import type { AttemptReviewQuestion } from '../lib/attempt-content-snapshot'
import type { SetAttemptQuestion } from '@/app/api/ucat/students/[studentId]/progress/sets/[attemptId]/route'
import type {
  MockAttemptQuestion,
  MockSetInfo,
} from '@/app/api/ucat/students/[studentId]/progress/mocks/[mockId]/route'
import { formatTimeSeconds } from '../lib/format-time'
import { SetAttemptAnalysisChart } from './set-attempt-analysis-chart'
import { MockAttemptAnalysisChart } from './mock-attempt-analysis-chart'
import { AttemptQuestionViewer } from './attempt-question-viewer'

const RESULT_COLORS = {
  correct: 'hsl(142 76% 36%)',
  partial: 'hsl(48 96% 53%)',
  incorrect: 'hsl(0 84% 60%)',
  not_attempted: 'hsl(var(--muted))',
} as const

export type CategoryBreakdown = {
  name: string
  score: number
  total: number
}

export type AttemptTiming = {
  timeTakenSeconds: number | null
  timeLimitSeconds: number | null
  examTimeLimitSeconds: number | null
  studentSpeed: number | null
  studentExamSpeed: number | null
}

function formatSpeed(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(2).replace(/\.00$/, '')}x`
}

function Metric({
  label,
  value,
  tooltip,
}: {
  label: string
  value: string
  tooltip: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help">
                <Info className="h-3.5 w-3.5" aria-label={`${label} explanation`} />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px]">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

export function AttemptTimingCard({
  timing,
  scope,
}: {
  timing: AttemptTiming
  scope: 'set' | 'mock'
}) {
  const time =
    timing.timeTakenSeconds != null && timing.timeLimitSeconds != null
      ? `${formatTimeSeconds(timing.timeTakenSeconds)} / ${formatTimeSeconds(timing.timeLimitSeconds)}`
      : timing.timeTakenSeconds != null
        ? formatTimeSeconds(timing.timeTakenSeconds)
        : '—'
  const showExamSpeed =
    timing.timeLimitSeconds !== timing.examTimeLimitSeconds &&
    timing.examTimeLimitSeconds != null

  return (
    <Card id="tour-attempt-timing" className={tutorCardCn('h-full')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Timing</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Metric
          label="Time"
          value={time}
          tooltip={`Time taken vs time limit for this ${scope}.`}
        />
        <Metric
          label={scope === 'mock' ? 'Mock speed' : 'Set speed'}
          value={formatSpeed(timing.studentSpeed)}
          tooltip="1x uses the full time limit; above 1x means the student finished early."
        />
        {showExamSpeed ? (
          <Metric
            label="Exam speed"
            value={formatSpeed(timing.studentExamSpeed)}
            tooltip="1x matches official exam pace; above 1x is faster."
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

export function AttemptScoreCard({
  title = 'Score',
  points,
  total,
  scaledScore,
  categoryBreakdown,
  accessory,
}: {
  title?: string
  points: number
  total: number
  scaledScore: number | null
  categoryBreakdown?: CategoryBreakdown[]
  accessory?: ReactNode
}) {
  return (
    <Card className={tutorCardCn('h-full')}>
      <CardHeader className="relative pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {accessory}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Scaled score</div>
          <div className="text-3xl font-bold tabular-nums">
            {scaledScore != null ? Math.round(scaledScore) : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">Points</div>
          <div className="text-xl font-semibold tabular-nums">
            {total > 0 ? `${points} / ${total}` : '—'}
          </div>
        </div>
        {categoryBreakdown?.length ? (
          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Category breakdown
            </div>
            <div className="flex flex-col gap-1.5">
              {categoryBreakdown.map((category) => (
                <div key={category.name} className="flex justify-between gap-2 text-sm">
                  <span className="truncate text-muted-foreground">{category.name}</span>
                  <span className="shrink-0 tabular-nums">
                    {category.score} / {category.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function SimpleNavigator({
  attempts,
  selectedIndex,
  onSelect,
  mockSets,
}: {
  attempts: Array<SetAttemptQuestion | MockAttemptQuestion>
  selectedIndex: number
  onSelect: (index: number) => void
  mockSets?: MockSetInfo[]
}) {
  const groups = useMemo(() => {
    const result: Array<{
      key: string
      label: string | null
      stems: Array<{ stemIndex: number; questions: Array<{ attempt: SetAttemptQuestion | MockAttemptQuestion; index: number }> }>
    }> = []
    for (let index = 0; index < attempts.length; index += 1) {
      const attempt = attempts[index]
      const setIndex = 'setIndex' in attempt ? attempt.setIndex : 0
      const key = String(setIndex)
      let setGroup = result.find((group) => group.key === key)
      if (!setGroup) {
        setGroup = {
          key,
          label: mockSets?.[setIndex]?.questionSetName ?? null,
          stems: [],
        }
        result.push(setGroup)
      }
      let stem = setGroup.stems.find((item) => item.stemIndex === attempt.stemIndex)
      if (!stem) {
        stem = { stemIndex: attempt.stemIndex, questions: [] }
        setGroup.stems.push(stem)
      }
      stem.questions.push({ attempt, index })
    }
    return result
  }, [attempts, mockSets])

  return (
    <div className="space-y-4 pb-1">
      {groups.map((group, groupIndex) => (
        <div key={group.key} className={cn(groupIndex > 0 && 'border-t border-border pt-4')}>
          {group.label ? (
            <div className="mb-2 text-xs font-medium text-muted-foreground">{group.label}</div>
          ) : null}
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            {group.stems.map((stem) => (
              <div key={stem.stemIndex} className="flex flex-col items-center gap-1">
                <div className="flex flex-wrap justify-center gap-1">
                  {stem.questions.map(({ attempt, index }) => (
                    <button
                      key={attempt.questionId}
                      type="button"
                      onClick={() => onSelect(index)}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-md text-sm font-semibold tabular-nums text-white transition',
                        selectedIndex === index ? 'shadow-sm opacity-100' : 'opacity-45'
                      )}
                      style={{ backgroundColor: RESULT_COLORS[attempt.result] }}
                    >
                      {attempt.questionNumber}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">
                  Stem {stem.stemIndex}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function AttemptQuestionNavigator({
  attempts,
  selectedIndex,
  onSelect,
  mockSets,
  setBoundaryIndices = [],
}: {
  attempts: Array<SetAttemptQuestion | MockAttemptQuestion>
  selectedIndex: number
  onSelect: (index: number) => void
  mockSets?: MockSetInfo[]
  setBoundaryIndices?: number[]
}) {
  const [view, setView] = useState<'simple' | 'timing'>('simple')
  const chartData = attempts.map((attempt) => ({
    questionNumber: attempt.questionNumber,
    timeSpentSeconds: attempt.timeSpentSeconds,
    result: attempt.result,
  }))
  return (
    <Card className={tutorCardCn('min-w-0 overflow-hidden')}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base font-medium">Question attempts</CardTitle>
        <SegmentedControl
          value={view}
          onValueChange={setView}
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'timing', label: 'Timing graph' },
          ]}
        />
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden">
        {view === 'simple' ? (
          <SimpleNavigator
            attempts={attempts}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
            mockSets={mockSets}
          />
        ) : mockSets ? (
          <MockAttemptAnalysisChart
            data={chartData}
            setBoundaryIndices={setBoundaryIndices}
            sets={mockSets}
            selectedQuestionIndex={selectedIndex}
            onBarClick={onSelect}
          />
        ) : (
          <SetAttemptAnalysisChart
            data={chartData}
            selectedQuestionIndex={selectedIndex}
            onBarClick={onSelect}
          />
        )}
      </CardContent>
    </Card>
  )
}

function ResultBadge({ result }: { result: SetAttemptQuestion['result'] }) {
  if (result === 'correct') return <Badge className="bg-emerald-500">Correct</Badge>
  if (result === 'partial') return <Badge className="bg-amber-500">Partially correct</Badge>
  if (result === 'incorrect') return <Badge variant="destructive">Incorrect</Badge>
  return <Badge variant="destructive">Not answered</Badge>
}

function TimingMeter({
  label,
  value,
  max,
  tone = 'primary',
}: {
  label: string
  value: number | null
  max: number
  tone?: 'primary' | 'muted' | 'amber'
}) {
  const width = value != null ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value != null ? formatTimeSeconds(value) : '—'}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full',
            tone === 'primary' && 'bg-primary',
            tone === 'muted' && 'bg-muted-foreground/55',
            tone === 'amber' && 'bg-amber-500'
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export function AttemptQuestionReview({
  questions,
  attempts,
  selectedIndex,
  onSelect,
}: {
  questions: AttemptReviewQuestion[]
  attempts: Array<SetAttemptQuestion | MockAttemptQuestion>
  selectedIndex: number
  onSelect: (index: number) => void
}) {
  const question = questions[selectedIndex]
  const attempt = attempts[selectedIndex]
  if (!question || !attempt) return null
  const maxPoints = question.questionType === 'syllogism' ? 2 : 1
  const timingMax = Math.max(
    attempt.timeSpentSeconds ?? 0,
    attempt.averageTimeSeconds ?? 0,
    attempt.timeBurdenSeconds ?? 0,
    1
  )

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card className={tutorCardCn('min-w-0 overflow-hidden')}>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              Question {selectedIndex + 1} of {questions.length}
              <Flag
                className={cn(
                  'h-4 w-4',
                  attempt.isFlagged
                    ? 'fill-amber-500 text-amber-500'
                    : 'text-muted-foreground/45'
                )}
              />
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Points: {attempt.score ?? 0} / {maxPoints}</span>
              <ResultBadge result={attempt.result} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className={tutorBtnIconOutline}
              disabled={selectedIndex === 0}
              onClick={() => onSelect(Math.max(0, selectedIndex - 1))}
              aria-label="Previous question"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={tutorBtnIconOutline}
              disabled={selectedIndex === questions.length - 1}
              onClick={() => onSelect(Math.min(questions.length - 1, selectedIndex + 1))}
              aria-label="Next question"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-h-[420px]">
          <AttemptQuestionViewer
            question={question}
            selectedOptionId={attempt.questionAnswerOptionId}
            syllogismSnapshot={attempt.answerSnapshot}
            result={attempt.result}
          />
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-4">
        <Card className={tutorCardCn()}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Answer explanation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {question.answerExplanation || question.answerExplanationJson ? (
              <UcatRichContentBlock
                json={question.answerExplanationJson}
                plainText={question.answerExplanation ?? ''}
                textTone="theme"
                paragraphSpacing
              />
            ) : (
              question.options.some(
                (option) =>
                  option.answerExplanation || option.answerExplanationJson
              ) ? null : (
                <p className="text-sm text-muted-foreground">No explanation available.</p>
              )
            )}
            {question.options
              .filter(
                (option) =>
                  option.answerExplanation || option.answerExplanationJson
              )
              .map((option) => (
                <div key={option.id} className="rounded-md border border-border p-3">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    Option {String.fromCharCode(65 + option.index)}
                  </div>
                  <UcatRichContentBlock
                    json={option.answerExplanationJson}
                    plainText={option.answerExplanation ?? ''}
                    textTone="theme"
                    paragraphSpacing
                  />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className={tutorCardCn()}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Question timing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <TimingMeter label="Your time" value={attempt.timeSpentSeconds} max={timingMax} />
            {attempt.averageTimeSeconds != null ? (
              <TimingMeter
                label="Average time"
                value={attempt.averageTimeSeconds}
                max={timingMax}
                tone="muted"
              />
            ) : null}
            {attempt.timeBurdenSeconds != null ? (
              <TimingMeter
                label="Time burden"
                value={attempt.timeBurdenSeconds}
                max={timingMax}
                tone="amber"
              />
            ) : null}
          </CardContent>
        </Card>

        <Card className={tutorCardCn()}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Question properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="shrink-0 text-xs font-medium text-muted-foreground">
                Stem category
              </div>
              {attempt.categoryName ? (
                <Badge variant="secondary">{attempt.categoryName}</Badge>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="shrink-0 text-xs font-medium text-muted-foreground">
                Question tags
              </div>
              {attempt.questionTags.length > 0 ? (
                <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
                  {attempt.questionTags.map((tag) => (
                    <Badge key={tag.name} variant="outline">{tag.name}</Badge>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
            {attempt.difficulty != null ? (
              <div className="flex items-start justify-between gap-4">
                <div className="shrink-0 text-xs font-medium text-muted-foreground">
                  Difficulty
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="text-right text-xs tabular-nums">
                    {attempt.difficulty}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            (attempt.difficulty /
                              (attempt.difficulty > 5 ? 10 : 5)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
