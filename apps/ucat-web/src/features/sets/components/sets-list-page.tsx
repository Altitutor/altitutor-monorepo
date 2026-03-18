'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge, Label, SearchableSelect } from '@altitutor/ui'
import { UcatPageHeader } from '@/features/layout'
import { useAttemptedSetIds, useSets } from '@/features/sets/hooks/use-sets'
import {
  filterSets,
  type SetsFilters,
  type StudentSetRow,
} from '@/features/sets/api/sets-api'
import {
  formatSetSections,
  SECTION_NUMBER_TO_NAME,
} from '@/features/sets/lib/section-labels'
import { extractTextFromRichJson } from '@/features/question-engine/model/rich-text'
import type { JsonLike } from '@/features/question-engine/model/rich-text'
import { ListChecks } from 'lucide-react'

const PAGE_SIZE = 10
const SECTION_OPTIONS = [
  { value: 'all', label: 'All sections' },
  { value: '1', label: 'Verbal Reasoning' },
  { value: '2', label: 'Decision Making' },
  { value: '3', label: 'Quantitative Reasoning' },
  { value: '4', label: 'Situational Judgement' },
]

export type SetsListPageProps = {
  /** When provided, pre-filters sets to this section and hides the section filter */
  sectionNumber?: number
}

function formatTimeLimit(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return 'Untimed'
  return `${Math.round(seconds / 60)} min`
}

export function SetsListPage({ sectionNumber: sectionNumberProp }: SetsListPageProps = {}) {
  const { data: sets, isLoading, error } = useSets()
  const { data: attemptedSetIds = new Set<string>() } = useAttemptedSetIds()
  const [filters, setFilters] = useState<SetsFilters>(() =>
    sectionNumberProp != null ? { sectionNumber: sectionNumberProp } : {}
  )
  const [page, setPage] = useState(0)

  const effectiveFilters = useMemo(
    () => (sectionNumberProp != null ? { ...filters, sectionNumber: sectionNumberProp } : filters),
    [filters, sectionNumberProp]
  )

  const filteredSets = useMemo(() => {
    if (!sets) return []
    return filterSets(sets, effectiveFilters, attemptedSetIds)
  }, [sets, effectiveFilters, attemptedSetIds])

  const totalPages = Math.max(1, Math.ceil(filteredSets.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const paginatedSets = useMemo(() => {
    const start = currentPage * PAGE_SIZE
    return filteredSets.slice(start, start + PAGE_SIZE)
  }, [filteredSets, currentPage])

  const handleFilterChange = (key: keyof SetsFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (value === 'all' || !value) {
        delete next[key]
      } else if (key === 'sectionNumber') {
        next.sectionNumber = parseInt(value, 10)
      } else if (key === 'attempted') {
        next.attempted = value === 'unattempted' ? 'unattempted' : undefined
      } else {
        ;(next as Record<string, string>)[key] = value
      }
      return next
    })
    setPage(0)
  }

  const sectionTitle =
    sectionNumberProp != null
      ? SECTION_NUMBER_TO_NAME[sectionNumberProp] ?? `Section ${sectionNumberProp}`
      : null
  const pageTitle = sectionTitle ? `${sectionTitle} sets` : 'Sets'
  const pageDescription = sectionTitle
    ? `Practice question sets for ${sectionTitle}.`
    : 'Choose a set to start practicing.'

  const backProps =
    sectionNumberProp != null
      ? { backHref: '/sets' as const, backLabel: 'Back to sets' as const }
      : {}

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader title={pageTitle} description={pageDescription} {...backProps} />
        <p className="text-sm text-muted-foreground">Loading sets...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader title={pageTitle} description={pageDescription} {...backProps} />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load sets'}
        </p>
      </div>
    )
  }

  if (!sets || sets.length === 0) {
    return (
      <div className="space-y-6">
        <UcatPageHeader title={pageTitle} description={pageDescription} {...backProps} />
        <p className="text-sm text-muted-foreground">No sets available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title={pageTitle}
        description={pageDescription}
        backHref={sectionNumberProp != null ? '/sets' : undefined}
        backLabel={sectionNumberProp != null ? 'Back to sets' : undefined}
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Timing</Label>
            <SearchableSelect<{ value: string; label: string }>
              items={[
                { value: 'all', label: 'All' },
                { value: 'timed', label: 'Timed' },
                { value: 'untimed', label: 'Untimed' },
              ]}
              value={
                [
                  { value: 'all', label: 'All' },
                  { value: 'timed', label: 'Timed' },
                  { value: 'untimed', label: 'Untimed' },
                ].find((i) => i.value === (filters.timed ?? 'all')) ?? null
              }
              onValueChange={(item) => item && handleFilterChange('timed', item.value)}
              getItemLabel={(i) => i.label}
              getItemId={(i) => i.value}
              placeholder="All"
              triggerClassName="w-[140px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <SearchableSelect<{ value: string; label: string }>
              items={[
                { value: 'all', label: 'All' },
                { value: 'my', label: 'My sets' },
                { value: 'public', label: 'Public sets' },
              ]}
              value={
                [
                  { value: 'all', label: 'All' },
                  { value: 'my', label: 'My sets' },
                  { value: 'public', label: 'Public sets' },
                ].find((i) => i.value === (filters.source ?? 'all')) ?? null
              }
              onValueChange={(item) => item && handleFilterChange('source', item.value)}
              getItemLabel={(i) => i.label}
              getItemId={(i) => i.value}
              placeholder="All"
              triggerClassName="w-[140px]"
            />
          </div>
          {sectionNumberProp == null ? (
            <div className="space-y-2">
              <Label>Section</Label>
              <SearchableSelect<(typeof SECTION_OPTIONS)[number]>
                items={SECTION_OPTIONS}
                value={
                  SECTION_OPTIONS.find(
                    (opt) => opt.value === (filters.sectionNumber?.toString() ?? 'all')
                  ) ?? null
                }
                onValueChange={(item) => item && handleFilterChange('sectionNumber', item.value)}
                getItemLabel={(opt) => opt.label}
                getItemId={(opt) => opt.value}
                placeholder="All sections"
                triggerClassName="w-[180px]"
              />
            </div>
          ) : null}
          {sectionNumberProp != null ? (
            <div className="space-y-2">
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
          ) : null}
        </div>

        <ul className="space-y-3">
          {paginatedSets.map((set) => (
            <SetCard
              key={set.id}
              set={set}
              attemptedSetIds={attemptedSetIds}
              sectionNumber={sectionNumberProp}
            />
          ))}
        </ul>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredSets.length)} of{' '}
              {filteredSets.length}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SetCard({
  set,
  attemptedSetIds,
  sectionNumber,
}: {
  set: StudentSetRow
  attemptedSetIds: Set<string>
  sectionNumber?: number
}) {
  const title =
    extractTextFromRichJson(set.name as JsonLike) ||
    extractTextFromRichJson(set.description as JsonLike) ||
    'Question set'
  const timeLabel = formatTimeLimit(set.time_limit_seconds)
  const sectionsText = formatSetSections(set.sections)
  const attempted = attemptedSetIds.has(set.id)
  const setHref =
    sectionNumber != null
      ? `/sets/sections/${sectionNumber}/${encodeURIComponent(set.id)}`
      : `/sets/${encodeURIComponent(set.id)}`

  return (
    <li>
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
