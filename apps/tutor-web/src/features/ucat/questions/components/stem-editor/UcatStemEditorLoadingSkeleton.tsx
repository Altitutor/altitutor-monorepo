'use client'

import { Skeleton } from '@altitutor/ui'
import { cn } from '@/shared/utils'
import { tutorCardCn } from '@/shared/lib/tutor-visual'

type UcatStemEditorLoadingSkeletonProps = {
  className?: string
}

/**
 * Full-size placeholder matching the stem editor shell layout so dialogs
 * stay at their target dimensions while stem detail is loading.
 */
export function UcatStemEditorLoadingSkeleton({ className }: UcatStemEditorLoadingSkeletonProps) {
  return (
    <div
      className={cn('flex min-h-0 flex-1 overflow-hidden', className)}
      aria-busy="true"
      aria-label="Loading question stem"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-10 shrink-0 items-center justify-between gap-3 bg-[#003060] px-3">
          <Skeleton className="h-4 w-36 bg-white/20" />
          <Skeleton className="h-4 w-28 bg-white/20" />
        </div>
        <div className="flex h-9 shrink-0 items-center justify-between gap-3 bg-[#4a6fa5] px-3">
          <Skeleton className="h-4 w-24 bg-white/25" />
          <Skeleton className="h-4 w-20 bg-white/25" />
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-hidden bg-white p-5">
          <Skeleton className="h-4 w-3/4 bg-muted" />
          <Skeleton className="h-4 w-full bg-muted" />
          <Skeleton className="h-4 w-5/6 bg-muted" />
          <Skeleton className="mt-6 h-28 w-full bg-muted" />
          <div className="mt-6 space-y-3">
            <Skeleton className="h-10 w-full bg-muted" />
            <Skeleton className="h-10 w-full bg-muted" />
            <Skeleton className="h-10 w-full bg-muted" />
            <Skeleton className="h-10 w-full bg-muted" />
          </div>
        </div>
        <div className="flex h-10 shrink-0 items-center justify-between gap-3 bg-[#003060] px-3">
          <Skeleton className="h-4 w-20 bg-white/20" />
          <Skeleton className="h-4 w-24 bg-white/20" />
        </div>
      </div>

      <aside className="hidden h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden border-l bg-background p-4 lg:flex">
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          <Skeleton className="h-8 rounded-[calc(var(--radius)-0.125rem)] bg-background" />
          <Skeleton className="h-8 rounded-[calc(var(--radius)-0.125rem)] bg-transparent" />
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-hidden">
          <div className={tutorCardCn('space-y-3 p-3')}>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className={tutorCardCn('space-y-3 p-3')}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className={tutorCardCn('space-y-3 p-3')}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </aside>
    </div>
  )
}
