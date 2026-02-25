'use client'

import Link from 'next/link'
import { useSets } from '@/features/sets/hooks/use-sets'
import { extractTextFromRichJson } from '@/features/question-engine/model/rich-text'
import type { JsonLike } from '@/features/question-engine/model/rich-text'
import { UcatPagePlaceholder } from '@altitutor/ui'
import { ListChecks } from 'lucide-react'

export function SetsListPage() {
  const { data: sets, isLoading, error } = useSets()

  if (isLoading) {
    return (
      <UcatPagePlaceholder title="Sets" description="Practice question sets.">
        <p className="text-sm text-muted-foreground">Loading sets...</p>
      </UcatPagePlaceholder>
    )
  }

  if (error) {
    return (
      <UcatPagePlaceholder title="Sets" description="Practice question sets.">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load sets'}
        </p>
      </UcatPagePlaceholder>
    )
  }

  if (!sets || sets.length === 0) {
    return (
      <UcatPagePlaceholder title="Sets" description="Practice question sets.">
        <p className="text-sm text-muted-foreground">No sets available.</p>
      </UcatPagePlaceholder>
    )
  }

  return (
    <UcatPagePlaceholder title="Sets" description="Choose a set to start practicing.">
      <ul className="grid gap-3 sm:grid-cols-2">
        {sets.map((set) => {
          const title =
            extractTextFromRichJson(set.name as JsonLike) ||
            extractTextFromRichJson(set.description as JsonLike) ||
            'Question set'
          const timeLabel =
            set.time_limit_seconds != null
              ? `${Math.round(set.time_limit_seconds / 60)} min`
              : null
          return (
            <li key={set.id}>
              <Link
                href={`/sets?setId=${encodeURIComponent(set.id)}`}
                className="flex items-center gap-3 rounded-xl bg-card text-card-foreground p-4 shadow-sm transition-colors hover:bg-muted border border-border"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
                  <ListChecks className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{title}</p>
                  {timeLabel ? (
                    <p className="text-xs text-muted-foreground">{timeLabel}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </UcatPagePlaceholder>
  )
}
