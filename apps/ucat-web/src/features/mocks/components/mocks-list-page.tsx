'use client'

import Link from 'next/link'
import { useMocks } from '@/features/mocks/hooks/use-mocks'
import { UcatPagePlaceholder } from '@altitutor/ui'
import { NotebookText } from 'lucide-react'

export function MocksListPage() {
  const { data: mocks, isLoading, error } = useMocks()

  if (isLoading) {
    return (
      <UcatPagePlaceholder title="Mocks" description="Full-length UCAT mock exams.">
        <p className="text-sm text-muted-foreground">Loading mocks...</p>
      </UcatPagePlaceholder>
    )
  }

  if (error) {
    return (
      <UcatPagePlaceholder title="Mocks" description="Full-length UCAT mock exams.">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load mocks'}
        </p>
      </UcatPagePlaceholder>
    )
  }

  if (!mocks || mocks.length === 0) {
    return (
      <UcatPagePlaceholder title="Mocks" description="Full-length UCAT mock exams.">
        <p className="text-sm text-muted-foreground">No mocks available.</p>
      </UcatPagePlaceholder>
    )
  }

  return (
    <UcatPagePlaceholder title="Mocks" description="Choose a mock to start the exam (first set).">
      <ul className="grid gap-3 sm:grid-cols-2">
        {mocks.map((mock) => (
          <li key={mock.id}>
            <Link
              href={`/mocks?mockId=${encodeURIComponent(mock.id)}`}
              className="flex items-center gap-3 rounded-xl bg-card text-card-foreground p-4 shadow-sm transition-colors hover:bg-muted border border-border"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-sidebar-foreground">
                <NotebookText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{mock.name ?? 'Mock exam'}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </UcatPagePlaceholder>
  )
}
