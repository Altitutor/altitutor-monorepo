'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { UcatPagePlaceholder } from '@altitutor/ui'
import { useMocks } from '@/features/mocks'

type MockDetailPageProps = {
  mockId: string
}

export function MockDetailPage({ mockId }: MockDetailPageProps) {
  const { data: mocks, isLoading, error } = useMocks()

  const mock = useMemo(
    () => (mocks ?? []).find((item) => item.id === mockId),
    [mocks, mockId]
  )

  if (isLoading) {
    return (
      <UcatPagePlaceholder title="Mock" description="Full-length UCAT mock exam details.">
        <p className="text-sm text-muted-foreground">Loading mock...</p>
      </UcatPagePlaceholder>
    )
  }

  if (error) {
    return (
      <UcatPagePlaceholder title="Mock" description="Full-length UCAT mock exam details.">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load mock'}
        </p>
      </UcatPagePlaceholder>
    )
  }

  if (!mocks || mocks.length === 0) {
    return (
      <UcatPagePlaceholder title="Mock" description="Full-length UCAT mock exam details.">
        <p className="text-sm text-muted-foreground">No mocks available.</p>
        <div className="mt-4">
          <Link
            href="/mocks"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-card border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Back to all mocks
          </Link>
        </div>
      </UcatPagePlaceholder>
    )
  }

  if (!mock) {
    return (
      <UcatPagePlaceholder title="Mock" description="Full-length UCAT mock exam details.">
        <p className="text-sm text-red-600 dark:text-red-400">Mock not found.</p>
        <div className="mt-4">
          <Link
            href="/mocks"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-card border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Back to all mocks
          </Link>
        </div>
      </UcatPagePlaceholder>
    )
  }

  const createdAt =
    mock.created_at != null ? new Date(mock.created_at).toLocaleString(undefined, { dateStyle: 'medium' }) : null

  const updatedAt =
    mock.updated_at != null ? new Date(mock.updated_at).toLocaleString(undefined, { dateStyle: 'medium' }) : null

  return (
    <UcatPagePlaceholder title="Mock" description="Review this full-length UCAT mock before starting.">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">{mock.name ?? 'Mock exam'}</h1>
          <p className="text-sm text-muted-foreground">
            This mock exam will launch the full UCAT question engine using all sets included in this mock.
          </p>
        </header>

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

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/exam/mocks?id=${encodeURIComponent(mock.id)}`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground"
          >
            Launch mock
          </Link>
          <Link
            href="/mocks"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-card border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Back to all mocks
          </Link>
        </div>
      </div>
    </UcatPagePlaceholder>
  )
}

