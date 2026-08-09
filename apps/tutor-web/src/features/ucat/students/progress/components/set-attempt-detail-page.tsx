'use client'

import { useMemo, useState } from 'react'
import { UcatPageHeader } from '@/features/ucat/shared/components'
import { useSetAttemptDetail } from '../hooks/useSetAttemptDetail'
import { useMockAttemptDetail } from '../hooks/useMockAttemptDetail'
import {
  AttemptQuestionNavigator,
  AttemptQuestionReview,
  AttemptScoreCard,
  AttemptTimingCard,
  type CategoryBreakdown,
} from './attempt-review-ui'
import { getAnswerSchemeMaximum } from '@altitutor/ucat-response-contract'

type SetAttemptDetailPageProps = {
  studentId: string
  attemptId: string
  basePath: string
  studentName?: string
  mockAttemptId?: string
}

export function SetAttemptDetailPage({
  studentId,
  attemptId,
  basePath,
  studentName,
  mockAttemptId,
}: SetAttemptDetailPageProps) {
  const { data, isLoading, error } = useSetAttemptDetail(studentId, attemptId)
  const { data: mockData } = useMockAttemptDetail(studentId, mockAttemptId ?? null)
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0)

  const categoryBreakdown = useMemo(() => {
    const byCategory = new Map<string, CategoryBreakdown>()
    for (const question of data?.questionAttempts ?? []) {
      const name = question.categoryName ?? 'Uncategorized'
      const current = byCategory.get(name) ?? { name, score: 0, total: 0 }
      current.score += question.score ?? 0
      current.total += question.answerScheme
        ? getAnswerSchemeMaximum(question.answerScheme)
        : 1
      byCategory.set(name, current)
    }
    return [...byCategory.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [data?.questionAttempts])

  const progressRoot = basePath
    .replace(/\/mocks\/[^/]+\/sets\/[^/]+$/, '')
    .replace(/\/sets\/[^/]+$/, '')
  const backHref = mockAttemptId
    ? `${progressRoot}/mocks/${mockAttemptId}`
    : progressRoot
  const breadcrumbs: { label: string; href?: string }[] = [
    { label: 'UCAT', href: '/ucat' },
    { label: 'Students', href: '/ucat/students' },
    { label: studentName ?? 'Student', href: progressRoot },
    { label: 'Progress', href: progressRoot },
  ]
  if (mockAttemptId) {
    breadcrumbs.push({
      label: mockData?.mockName ?? 'Mock',
      href: `${progressRoot}/mocks/${mockAttemptId}`,
    })
  }
  breadcrumbs.push({ label: data?.questionSetName ?? 'Set' })

  if (isLoading) {
    return (
      <div className="space-y-6 py-8 md:py-10">
        <UcatPageHeader title="Loading..." backHref={backHref} backLabel="Back" />
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
          title="Set attempt"
          description={error ? 'Could not load set attempt.' : 'No data available.'}
          backHref={backHref}
          backLabel="Back"
        />
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
      </div>
    )
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title={data.questionSetName ?? 'Set attempt'}
        description={`Attempt from ${new Date(data.attemptedAt).toLocaleDateString()}`}
        backHref={backHref}
        backLabel="Back"
        breadcrumbs={breadcrumbs}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <AttemptScoreCard
          points={data.scorePoints ?? 0}
          total={data.totalPoints ?? 0}
          scaledScore={data.scaledScore}
          categoryBreakdown={categoryBreakdown}
        />
        <AttemptTimingCard
          scope="set"
          timing={{
            timeTakenSeconds: data.timeTakenSeconds,
            timeLimitSeconds: data.setTimeLimitSeconds,
            examTimeLimitSeconds: data.examTimeLimitSeconds,
            studentSpeed: data.studentSetSpeed,
            studentExamSpeed: data.studentExamSpeed,
          }}
        />
      </div>

      <AttemptQuestionNavigator
        attempts={data.questionAttempts}
        selectedIndex={selectedQuestionIndex}
        onSelect={setSelectedQuestionIndex}
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
