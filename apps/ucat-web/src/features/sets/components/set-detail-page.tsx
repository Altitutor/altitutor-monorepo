'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { UcatPagePlaceholder } from '@altitutor/ui'
import { extractTextFromRichJson, type JsonLike } from '@/features/question-engine/model/rich-text'
import { useSets } from '@/features/sets'

type SetDetailPageProps = {
  setId: string
}

export function SetDetailPage({ setId }: SetDetailPageProps) {
  const { data: sets, isLoading, error } = useSets()

  const set = useMemo(
    () => (sets ?? []).find((item) => item.id === setId),
    [sets, setId]
  )

  if (isLoading) {
    return (
      <UcatPagePlaceholder title="Set" description="Practice question set details.">
        <p className="text-sm text-muted-foreground">Loading set...</p>
      </UcatPagePlaceholder>
    )
  }

  if (error) {
    return (
      <UcatPagePlaceholder title="Set" description="Practice question set details.">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load set'}
        </p>
      </UcatPagePlaceholder>
    )
  }

  if (!sets || sets.length === 0) {
    return (
      <UcatPagePlaceholder title="Set" description="Practice question set details.">
        <p className="text-sm text-muted-foreground">No sets available.</p>
        <div className="mt-4">
          <Link
            href="/sets"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-card border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Back to all sets
          </Link>
        </div>
      </UcatPagePlaceholder>
    )
  }

  if (!set) {
    return (
      <UcatPagePlaceholder title="Set" description="Practice question set details.">
        <p className="text-sm text-red-600 dark:text-red-400">Set not found.</p>
        <div className="mt-4">
          <Link
            href="/sets"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-card border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Back to all sets
          </Link>
        </div>
      </UcatPagePlaceholder>
    )
  }

  const title =
    extractTextFromRichJson(set.name as JsonLike) ||
    extractTextFromRichJson(set.description as JsonLike) ||
    'Question set'

  const description = extractTextFromRichJson(set.description as JsonLike)

  const timeLabel =
    set.time_limit_seconds != null
      ? set.time_limit_seconds === 0
        ? 'Untimed'
        : `${Math.round(set.time_limit_seconds / 60)} minute${set.time_limit_seconds / 60 === 1 ? '' : 's'}`
      : null

  const createdAt =
    set.created_at != null ? new Date(set.created_at).toLocaleString(undefined, { dateStyle: 'medium' }) : null

  const updatedAt =
    set.updated_at != null ? new Date(set.updated_at).toLocaleString(undefined, { dateStyle: 'medium' }) : null

  return (
    <UcatPagePlaceholder title="Set" description="Review this practice set before starting.">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </header>

        <section className="space-y-2 rounded-xl bg-card text-card-foreground p-4 shadow-sm border border-border">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-muted-foreground">Time limit</dt>
              <dd>{timeLabel ?? 'No time limit specified'}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Type</dt>
              <dd>{set.is_student_generated ? 'Generated from your performance' : 'Standard UCAT practice set'}</dd>
            </div>
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
            href={`/exam/sets?id=${encodeURIComponent(set.id)}`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground"
          >
            Launch set
          </Link>
          <Link
            href="/sets"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-card border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Back to all sets
          </Link>
        </div>
      </div>
    </UcatPagePlaceholder>
  )
}

