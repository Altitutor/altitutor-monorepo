'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Badge,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui'
import { UcatPageHeader } from '@/features/layout'
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

const PAGE_SIZE = 10
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

export function SetsListPage() {
  const { data: sets, isLoading, error } = useSets()
  const { data: attemptedSetIds = new Set<string>() } = useAttemptedSetIds()
  const [filters, setFilters] = useState<SetsFilters>({})
  const [page, setPage] = useState(0)

  const filteredSets = useMemo(() => {
    if (!sets) return []
    return filterSets(sets, filters)
  }, [sets, filters])

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
      } else {
        ;(next as Record<string, string>)[key] = value
      }
      return next
    })
    setPage(0)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader title="Sets" description="Practice question sets." />
        <p className="text-sm text-muted-foreground">Loading sets...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader title="Sets" description="Practice question sets." />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load sets'}
        </p>
      </div>
    )
  }

  if (!sets || sets.length === 0) {
    return (
      <div className="space-y-6">
        <UcatPageHeader title="Sets" description="Practice question sets." />
        <p className="text-sm text-muted-foreground">No sets available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader title="Sets" description="Choose a set to start practicing." />
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Timing</Label>
            <Select
              value={filters.timed ?? 'all'}
              onValueChange={(v) => handleFilterChange('timed', v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="timed">Timed</SelectItem>
                <SelectItem value="untimed">Untimed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Select
              value={filters.source ?? 'all'}
              onValueChange={(v) => handleFilterChange('source', v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="my">My sets</SelectItem>
                <SelectItem value="public">Public sets</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Section</Label>
            <Select
              value={filters.sectionNumber?.toString() ?? 'all'}
              onValueChange={(v) => handleFilterChange('sectionNumber', v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All sections" />
              </SelectTrigger>
              <SelectContent>
                {SECTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ul className="space-y-3">
          {paginatedSets.map((set) => (
            <SetCard key={set.id} set={set} attemptedSetIds={attemptedSetIds} />
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
}: {
  set: StudentSetRow
  attemptedSetIds: Set<string>
}) {
  const title =
    extractTextFromRichJson(set.name as JsonLike) ||
    extractTextFromRichJson(set.description as JsonLike) ||
    'Question set'
  const timeLabel = formatTimeLimit(set.time_limit_seconds)
  const sectionsText = formatSetSections(set.sections)
  const attempted = attemptedSetIds.has(set.id)

  return (
    <li>
      <Link
        href={`/sets/${encodeURIComponent(set.id)}`}
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
