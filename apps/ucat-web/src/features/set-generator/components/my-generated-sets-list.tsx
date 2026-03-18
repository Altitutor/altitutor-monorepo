'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { Badge, ListToolbar, TablePagination } from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { useAttemptedSetIds, useSets } from '@/features/sets/hooks/use-sets'
import {
  filterSets,
  type SetsFilters,
  type StudentSetRow,
} from '@/features/sets/api/sets-api'
import { recordToSetsFilters } from '@/features/sets/lib/filter-adapters'
import { formatSetSections } from '@/features/sets/lib/section-labels'
import { extractTextFromRichJson } from '@/features/question-engine/model/rich-text'
import type { JsonLike } from '@/features/question-engine/model/rich-text'
import { ListChecks } from 'lucide-react'

const DEFAULT_PAGE_SIZE = 10

const SECTION_OPTIONS: DataTableFilterDefinition['options'] = [
  { value: 1, label: 'Verbal Reasoning' },
  { value: 2, label: 'Decision Making' },
  { value: 3, label: 'Quantitative Reasoning' },
  { value: 4, label: 'Situational Judgement' },
]

const ATTEMPTED_OPTIONS: DataTableFilterDefinition['options'] = [
  { value: 'unattempted', label: 'Unattempted' },
]

const FILTER_DEFINITIONS: DataTableFilterDefinition[] = [
  { key: 'sectionNumber', label: 'Section', options: SECTION_OPTIONS },
  { key: 'attempted', label: 'Status', options: ATTEMPTED_OPTIONS },
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
  const [search, setSearch] = useState('')
  const [filtersRecord, setFiltersRecord] = useState<Record<string, unknown[]>>(
    () =>
      initialFilters?.sectionNumber != null
        ? {
            sectionNumber: [initialFilters.sectionNumber],
            ...(initialFilters.attempted === 'unattempted' && {
              attempted: ['unattempted'],
            }),
          }
        : ({} as Record<string, unknown[]>)
  )
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['ucat', 'attempted-set-ids'] })
  }, [queryClient])

  useEffect(() => {
    if (initialFilters?.sectionNumber != null || initialFilters?.attempted) {
      setFiltersRecord((prev) => ({
        ...prev,
        ...(initialFilters.sectionNumber != null && {
          sectionNumber: [initialFilters.sectionNumber],
        }),
        ...(initialFilters.attempted === 'unattempted' && {
          attempted: ['unattempted'],
        }),
      }))
      setPage(0)
    }
  }, [initialFilters?.sectionNumber, initialFilters?.attempted])

  const mySets = useMemo(() => {
    if (!sets) return []
    return sets.filter((s) => s.is_student_generated === true)
  }, [sets])

  const effectiveFilters = useMemo(
    () => recordToSetsFilters(filtersRecord),
    [filtersRecord]
  )

  const filteredSets = useMemo(() => {
    return filterSets(
      mySets,
      { ...effectiveFilters, search: search.trim() || undefined },
      attemptedSetIds,
      (v) => extractTextFromRichJson(v as JsonLike)
    )
  }, [mySets, effectiveFilters, search, attemptedSetIds])

  const totalPages = Math.max(1, Math.ceil(filteredSets.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const paginatedSets = useMemo(() => {
    const start = currentPage * pageSize
    return filteredSets.slice(start, start + pageSize)
  }, [filteredSets, currentPage, pageSize])

  const handleFiltersChange = useCallback((filters: Record<string, unknown[]>) => {
    setFiltersRecord(filters)
    setPage(0)
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setPage(0)
  }, [])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setPage(0)
  }, [])

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">My generated sets</h2>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">My generated sets</h2>
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load sets'}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">My generated sets</h2>
      {mySets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No generated sets yet. Create one above.
        </p>
      ) : (
        <>
          <ListToolbar
            search={search}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search sets..."
            filterDefinitions={FILTER_DEFINITIONS}
            filters={filtersRecord}
            onFiltersChange={handleFiltersChange}
          />
          <ul className="space-y-3">
            {paginatedSets.map((set) => (
              <GeneratedSetCard
                key={set.id}
                set={set}
                attemptedSetIds={attemptedSetIds}
                isHighlighted={scrollToSetId === set.id}
                scrollIntoViewRef={scrollToSetId === set.id}
              />
            ))}
          </ul>
          {filteredSets.length > 0 && (
            <div className="border-t border-border pt-4 ucat-pagination">
              <TablePagination
                page={currentPage + 1}
                pageSize={pageSize}
                total={filteredSets.length}
                onPageChange={(p) => setPage(p - 1)}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
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
    <li ref={ref}>
      <Link
        href={setHref}
        className={`flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-muted ${isHighlighted ? 'ucat-set-highlight-transient' : ''}`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
          <ListChecks className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{title}</p>
          {sectionsText ? (
            <p className="text-xs text-muted-foreground truncate">
              {sectionsText}
            </p>
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
