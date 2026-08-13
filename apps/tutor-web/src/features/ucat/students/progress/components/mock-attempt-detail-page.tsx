'use client'

import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import { UcatPageHeader } from '@/features/ucat/shared/components'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import { useMockAttemptDetail } from '../hooks/useMockAttemptDetail'
import {
  AttemptQuestionNavigator,
  AttemptQuestionReview,
  AttemptScoreCard,
  AttemptTimingCard,
  type CategoryBreakdown,
} from './attempt-review-ui'
import { getAnswerSchemeMaximum } from '@altitutor/ucat-response-contract'

type MockAttemptDetailPageProps = {
  studentId: string
  mockAttemptId: string
  basePath: string
  studentName?: string
}

export function MockAttemptDetailPage({
  studentId,
  mockAttemptId,
  basePath,
  studentName,
}: MockAttemptDetailPageProps) {
  const { data, isLoading, error } = useMockAttemptDetail(studentId, mockAttemptId)
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0)
  const mocksPath = `${basePath}/mocks`

  const breakdownBySet = useMemo(() => {
    return (data?.sets ?? []).map((_, setIndex) => {
      const categories = new Map<string, CategoryBreakdown>()
      for (const question of data?.questionAttempts ?? []) {
        if (question.setIndex !== setIndex) continue
        const name = question.categoryName ?? 'Uncategorized'
        const current = categories.get(name) ?? { name, score: 0, total: 0 }
        current.score += question.score ?? 0
        current.total += question.answerScheme
          ? getAnswerSchemeMaximum(question.answerScheme)
          : 1
        categories.set(name, current)
      }
      return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name))
    })
  }, [data?.questionAttempts, data?.sets])

  const selectSet = (setIndex: number) => {
    const firstQuestionIndex = data?.questionAttempts.findIndex(
      (question) => question.setIndex === setIndex
    )
    if (firstQuestionIndex == null || firstQuestionIndex < 0) return
    setSelectedQuestionIndex(firstQuestionIndex)
    document
      .getElementById('attempt-review-questions')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (isLoading) {
    return (
      <div className="space-y-6 py-8 md:py-10">
        <UcatPageHeader title="Loading..." backHref={mocksPath} backLabel="Back to mocks" />
        <div className="animate-pulse space-y-6">
          <div className="h-32 rounded-xl bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6 py-8 md:py-10">
        <UcatPageHeader
          title="Mock attempt"
          description={error ? 'Could not load mock attempt.' : 'No data available.'}
          backHref={mocksPath}
          backLabel="Back to mocks"
        />
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
      </div>
    )
  }

  const breadcrumbs = [
    { label: 'UCAT', href: '/ucat' },
    { label: 'Students', href: '/ucat/students' },
    { label: studentName ?? 'Student', href: basePath },
    { label: 'Progress', href: basePath },
    { label: 'Mocks', href: mocksPath },
    { label: data.mockName ?? 'Mock' },
  ]

  return (
    <div className="min-w-0 max-w-full space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title={data.mockName ?? 'Mock attempt'}
        description={`Attempted ${new Date(data.attemptedAt).toLocaleDateString()}`}
        backHref={mocksPath}
        backLabel="Back to mocks"
        breadcrumbs={breadcrumbs}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={tutorCardCn('h-full')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Overall scaled score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-medium text-muted-foreground">Scaled score</div>
            <div className="text-3xl font-bold tabular-nums">
              {data.scaledScore != null ? Math.round(data.scaledScore) : '—'}
            </div>
          </CardContent>
        </Card>
        <AttemptTimingCard
          scope="mock"
          timing={{
            timeTakenSeconds: data.timeTakenSeconds,
            timeLimitSeconds: data.mockTimeLimitSeconds,
            examTimeLimitSeconds: data.examTimeLimitSeconds,
            studentSpeed: data.studentMockSpeed,
            studentExamSpeed: data.studentExamSpeed,
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.sets.map((set, setIndex) => (
          <button
            key={set.questionSetId}
            type="button"
            className="group block w-full text-left"
            onClick={() => selectSet(setIndex)}
          >
            <AttemptScoreCard
              title={set.questionSetName ?? 'Set'}
              points={set.scorePoints ?? 0}
              total={set.totalPoints ?? 0}
              scaledScore={set.scaledScore}
              categoryBreakdown={breakdownBySet[setIndex]}
              accessory={
                <ChevronRight className="absolute right-4 top-5 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              }
            />
          </button>
        ))}
      </div>

      <AttemptQuestionNavigator
        attempts={data.questionAttempts}
        selectedIndex={selectedQuestionIndex}
        onSelect={setSelectedQuestionIndex}
        mockSets={data.sets}
        setBoundaryIndices={data.setBoundaryIndices}
      />

      <div id="attempt-review-questions">
        <AttemptQuestionReview
          questions={data.questions}
          attempts={data.questionAttempts}
          selectedIndex={selectedQuestionIndex}
          onSelect={setSelectedQuestionIndex}
        />
      </div>
    </div>
  )
}
