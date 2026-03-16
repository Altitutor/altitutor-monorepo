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
import { useAttemptedMockIds, useMocks } from '@/features/mocks/hooks/use-mocks'
import {
  filterMocks,
  type MocksFilters,
  type StudentMockRow,
} from '@/features/mocks/api/mocks-api'
import { NotebookText } from 'lucide-react'

const PAGE_SIZE = 10

export function MocksListPage() {
  const { data: mocks, isLoading, error } = useMocks()
  const { data: attemptedMockIds = new Set<string>() } = useAttemptedMockIds()
  const [filters, setFilters] = useState<MocksFilters>({})
  const [page, setPage] = useState(0)

  const filteredMocks = useMemo(() => {
    if (!mocks) return []
    return filterMocks(mocks, filters)
  }, [mocks, filters])

  const totalPages = Math.max(1, Math.ceil(filteredMocks.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const paginatedMocks = useMemo(() => {
    const start = currentPage * PAGE_SIZE
    return filteredMocks.slice(start, start + PAGE_SIZE)
  }, [filteredMocks, currentPage])

  const handleFilterChange = (key: keyof MocksFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (value === 'all' || !value) {
        delete next[key]
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
        <UcatPageHeader title="Mocks" description="Full-length UCAT mock exams." />
        <p className="text-sm text-muted-foreground">Loading mocks...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader title="Mocks" description="Full-length UCAT mock exams." />
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load mocks'}
        </p>
      </div>
    )
  }

  if (!mocks || mocks.length === 0) {
    return (
      <div className="space-y-6">
        <UcatPageHeader title="Mocks" description="Full-length UCAT mock exams." />
        <p className="text-sm text-muted-foreground">No mocks available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader title="Mocks" description="Choose a mock to start the exam (first set)." />
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
                <SelectItem value="my">My mocks</SelectItem>
                <SelectItem value="public">Public mocks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ul className="space-y-3">
          {paginatedMocks.map((mock) => (
            <MockCard key={mock.id} mock={mock} attemptedMockIds={attemptedMockIds} />
          ))}
        </ul>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredMocks.length)} of{' '}
              {filteredMocks.length}
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

function MockCard({
  mock,
  attemptedMockIds,
}: {
  mock: StudentMockRow
  attemptedMockIds: Set<string>
}) {
  const timeLabel = mock.has_timed_sets ? 'Timed' : 'Untimed'
  const attempted = attemptedMockIds.has(mock.id)

  return (
    <li>
      <Link
        href={`/mocks/${encodeURIComponent(mock.id)}`}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-muted"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
          <NotebookText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{mock.name ?? 'Mock exam'}</p>
          {mock.set_count != null ? (
            <p className="text-xs text-muted-foreground">{mock.set_count} set{mock.set_count !== 1 ? 's' : ''}</p>
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
