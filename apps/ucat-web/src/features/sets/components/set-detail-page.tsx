'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ListChecks } from 'lucide-react'
import { UcatPageHeader } from '@/features/layout'
import { extractTextFromRichJson, type JsonLike } from '@/features/question-engine/model/rich-text'
import type { SetAttemptRow } from '@/features/sets/api/sets-api'
import { useSetAttempts, useSets } from '@/features/sets'

type SetDetailPageProps = {
  setId: string
}

export function SetDetailPage({ setId }: SetDetailPageProps) {
  const { data: sets, isLoading, error } = useSets()
  const { data: attempts = [] } = useSetAttempts(setId)

  const set = useMemo(
    () => (sets ?? []).find((item) => item.id === setId),
    [sets, setId]
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Set"
          description="Practice question set details."
          backHref="/sets"
          backLabel="Back to all sets"
        />
        <p className="text-sm text-muted-foreground">Loading set...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Set"
          description="Practice question set details."
          backHref="/sets"
          backLabel="Back to all sets"
        />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load set'}
        </p>
      </div>
    )
  }

  if (!sets || sets.length === 0) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Set"
          description="Practice question set details."
          backHref="/sets"
          backLabel="Back to all sets"
        />
        <p className="text-sm text-muted-foreground">No sets available.</p>
      </div>
    )
  }

  if (!set) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Set"
          description="Practice question set details."
          backHref="/sets"
          backLabel="Back to all sets"
        />
        <p className="text-sm text-red-600 dark:text-red-400">Set not found.</p>
      </div>
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
    <div className="space-y-6">
      <UcatPageHeader
        title={title}
        description={description ?? 'Review this practice set before starting.'}
        backHref="/sets"
        backLabel="Back to all sets"
        breadcrumbOverrides={{ 1: title }}
      />

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

        {attempts.length > 0 ? (
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <ListChecks className="h-4 w-4" />
              Previous attempts
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 text-left font-medium text-muted-foreground">Date</th>
                    <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Score</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Scaled</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a: SetAttemptRow) => (
                    <tr key={a.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4">
                        {new Date(a.attemptedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
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
            href={`/exam/sets?id=${encodeURIComponent(set.id)}`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-sidebar px-4 text-sm font-medium text-sidebar-foreground"
          >
            Launch set
          </Link>
        </div>
    </div>
  )
}

