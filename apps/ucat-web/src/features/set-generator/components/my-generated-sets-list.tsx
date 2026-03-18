'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Badge, Label, SearchableSelect } from '@altitutor/ui'
import { useAttemptedSetIds, useSets } from '@/features/sets/hooks/use-sets'
import {
  filterSets,
  type SetsFilters,
  type StudentSetRow,
} from '@/features/sets/api/sets-api'
import { formatSetSections } from '@/features/sets/lib/section-labels'
import { extractTextFromRichJson } from '@/features/question-engine/model/rich-text'
import type { JsonLike } from '@/features/question-engine/model/rich-text'
import { ListChecks } from 'lucide-react'

const SECTION_OPTIONS = [
  { value: 'all', label: 'All sections' },
  { value: '1', label: 'Verbal Reasoning' },
  { value: '2', label: 'Decision Making' },
  { value: '3', label: 'Quantitative Reasoning' },
  { value: '4', label: 'Situational Judgement' },
]

function formatTimeLimit(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return 'Untimed'
  return `${Math.round(seconds / 60)} min`
}

function useScrollIntoView(shouldScroll: boolean) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (shouldScroll && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [shouldScroll])
  return ref
}

export type MyGeneratedSetsListProps = {
  /** Initial filters to apply (e.g. when blocked from generating) */
  initialFilters?: Partial<SetsFilters>
  /** Set ID to scroll to and highlight */
  scrollToSetId?: string | null
}

export function MyGeneratedSetsList({
  initialFilters,
  scrollToSetId,
}: MyGeneratedSetsListProps = {}) {
  const queryClient = useQueryClient()
  const { data: sets, isLoading, error } = useSets()
  const { data: attemptedSetIds = new Set<string>() } = useAttemptedSetIds()
  const [filters, setFilters] = useState<SetsFilters>(() => ({
    source: 'my',
    ...initialFilters,
  }))

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['ucat', 'attempted-set-ids'] })
  }, [queryClient])

  useEffect(() => {
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      setFilters((prev) => ({ ...prev, ...initialFilters }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when section/attempted from parent change
  }, [initialFilters?.sectionNumber, initialFilters?.attempted])

  const mySets = useMemo(() => {
    if (!sets) return []
    return sets.filter((s) => s.is_student_generated === true)
  }, [sets])

  const filteredSets = useMemo(() => {
    return filterSets(mySets, filters, attemptedSetIds)
  }, [mySets, filters, attemptedSetIds])

  const handleFilterChange = (key: keyof SetsFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (value === 'all' || !value) {
        delete next[key as keyof SetsFilters]
      } else if (key === 'sectionNumber') {
        next.sectionNumber = parseInt(value, 10)
      } else if (key === 'attempted') {
        next.attempted = value === 'unattempted' ? 'unattempted' : undefined
      } else {
        ;(next as Record<string, string>)[key] = value
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">My generated sets</h2>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">My generated sets</h2>
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load sets'}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-lg font-semibold">My generated sets</h2>
      {mySets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No generated sets yet. Create one above.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-3">
              <Label>Section</Label>
              <SearchableSelect<(typeof SECTION_OPTIONS)[number]>
                items={SECTION_OPTIONS}
                value={
                  SECTION_OPTIONS.find(
                    (opt) => opt.value === (filters.sectionNumber?.toString() ?? 'all')
                  ) ?? null
                }
                onValueChange={(item) =>
                  item && handleFilterChange('sectionNumber', item.value)
                }
                getItemLabel={(opt) => opt.label}
                getItemId={(opt) => opt.value}
                placeholder="All sections"
                triggerClassName="w-[180px]"
              />
            </div>
            <div className="space-y-3">
              <Label>Status</Label>
              <SearchableSelect<{ value: string; label: string }>
                items={[
                  { value: 'all', label: 'All' },
                  { value: 'unattempted', label: 'Unattempted' },
                ]}
                value={
                  [
                    { value: 'all', label: 'All' },
                    { value: 'unattempted', label: 'Unattempted' },
                  ].find((i) => i.value === (filters.attempted ?? 'all')) ?? null
                }
                onValueChange={(item) =>
                  item && handleFilterChange('attempted', item.value)
                }
                getItemLabel={(i) => i.label}
                getItemId={(i) => i.value}
                placeholder="All"
                triggerClassName="w-[140px]"
              />
            </div>
          </div>
          <ul className="space-y-3">
            {filteredSets.map((set) => (
              <GeneratedSetCard
                key={set.id}
                set={set}
                attemptedSetIds={attemptedSetIds}
                isHighlighted={scrollToSetId === set.id}
                scrollIntoViewRef={scrollToSetId === set.id}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function GeneratedSetCard({
  set,
  attemptedSetIds,
  isHighlighted,
  scrollIntoViewRef,
}: {
  set: StudentSetRow
  attemptedSetIds: Set<string>
  isHighlighted?: boolean
  scrollIntoViewRef?: boolean
}) {
  const ref = useScrollIntoView(scrollIntoViewRef === true)
  const title =
    extractTextFromRichJson(set.name as JsonLike) ||
    extractTextFromRichJson(set.description as JsonLike) ||
    'Question set'
  const timeLabel = formatTimeLimit(set.time_limit_seconds)
  const sectionsText = formatSetSections(set.sections)
  const attempted = attemptedSetIds.has(set.id)
  const setHref = `/sets/set-generator/${encodeURIComponent(set.id)}`

  return (
    <li
      ref={ref}
      className={isHighlighted ? 'rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background' : undefined}
    >
      <Link
        href={setHref}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-muted"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
          <ListChecks className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{title}</p>
          {sectionsText ? (
            <p className="text-xs text-muted-foreground truncate">{sectionsText}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-right text-sm text-muted-foreground">
          {attempted ? <Badge variant="secondary">Attempted</Badge> : null}
          {timeLabel}
        </div>
      </Link>
    </li>
  )
}
