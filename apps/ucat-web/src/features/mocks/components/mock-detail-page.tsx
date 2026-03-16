'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { NotebookText } from 'lucide-react'
import { UcatPageHeader } from '@/features/layout'
import type { MockAttemptSectionScore, MockAttemptWithBreakdown } from '@/features/mocks/api/mocks-api'
import { useMockAttemptsWithBreakdown, useMocks } from '@/features/mocks'

type MockDetailPageProps = {
  mockId: string
}

export function MockDetailPage({ mockId }: MockDetailPageProps) {
  const { data: mocks, isLoading, error } = useMocks()
  const { data: attempts = [] } = useMockAttemptsWithBreakdown(mockId)

  const mock = useMemo(
    () => (mocks ?? []).find((item) => item.id === mockId),
    [mocks, mockId]
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock"
          description="Full-length UCAT mock exam details."
          backHref="/mocks"
          backLabel="Back to all mocks"
        />
        <p className="text-sm text-muted-foreground">Loading mock...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock"
          description="Full-length UCAT mock exam details."
          backHref="/mocks"
          backLabel="Back to all mocks"
        />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load mock'}
        </p>
      </div>
    )
  }

  if (!mocks || mocks.length === 0) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock"
          description="Full-length UCAT mock exam details."
          backHref="/mocks"
          backLabel="Back to all mocks"
        />
        <p className="text-sm text-muted-foreground">No mocks available.</p>
      </div>
    )
  }

  if (!mock) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock"
          description="Full-length UCAT mock exam details."
          backHref="/mocks"
          backLabel="Back to all mocks"
        />
        <p className="text-sm text-red-600 dark:text-red-400">Mock not found.</p>
      </div>
    )
  }

  const createdAt =
    mock.created_at != null ? new Date(mock.created_at).toLocaleString(undefined, { dateStyle: 'medium' }) : null

  const updatedAt =
    mock.updated_at != null ? new Date(mock.updated_at).toLocaleString(undefined, { dateStyle: 'medium' }) : null

  const sectionColumns = attempts.length > 0 && attempts[0].sectionScores.length > 0
    ? attempts[0].sectionScores
    : []

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title={mock.name ?? 'Mock exam'}
        description="This mock exam will launch the full UCAT question engine using all sets included in this mock."
        backHref="/mocks"
        backLabel="Back to all mocks"
        breadcrumbOverrides={{ 1: mock.name ?? 'Mock' }}
      />

      <section className="space-y-2 rounded-xl bg-card text-card-foreground p-4 shadow-sm border border-border">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {createdAt ? (
              <div>
                <dt className="font-medium text-muted-foreground">Created</dt>
                <dd>{createdAt}</dd>
              </div>
            ) : null}
            {updatedAt ? (
              <div>
                <dt className="font-medium text-muted-foreground">Last updated</dt>
                <dd>{updatedAt}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {attempts.length > 0 ? (
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <NotebookText className="h-4 w-4" />
              Previous attempts
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 text-left font-medium text-muted-foreground">Date</th>
                    {sectionColumns.map((sec: MockAttemptSectionScore) => (
                      <th key={sec.sectionNumber} className="pb-2 pr-3 text-right font-medium text-muted-foreground">
                        {sec.sectionName}
                      </th>
                    ))}
                    <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Score</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Scaled</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a: MockAttemptWithBreakdown) => (
                    <tr key={a.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4">
                        {new Date(a.attemptedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      {a.sectionScores.map((sec: MockAttemptSectionScore) => (
                        <td key={sec.sectionNumber} className="py-2 pr-3 text-right">
                          {sec.scorePoints != null && sec.totalPoints != null
                            ? `${sec.scorePoints}/${sec.totalPoints}`
                            : '—'}
                        </td>
                      ))}
                      <td className="py-2 pr-4 text-right">
                        {a.scorePoints != null && a.totalPoints != null
                          ? `${a.scorePoints} / ${a.totalPoints}`
                          : '—'}
                      </td>
                      <td className="py-2 text-right">
                        {a.scaledScore != null ? a.scaledScore : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <div className="flex justify-end">
          <Link
            href={`/exam/mocks?id=${encodeURIComponent(mock.id)}`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground"
          >
            Launch mock
          </Link>
        </div>
    </div>
  )
}

