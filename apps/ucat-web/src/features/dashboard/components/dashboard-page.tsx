'use client'

import Link from 'next/link'
import { Badge, Skeleton, UcatPagePlaceholder } from '@altitutor/ui'
import { ChevronRight } from 'lucide-react'
import { useComingSoon } from '@/features/layout/context/coming-soon-context'
import { useProgress } from '@/features/progress/hooks/use-progress'
import { dashboardCards } from '@/features/dashboard/config/dashboard-cards'
import { NextSessionCard } from '@/features/dashboard/components/next-session-card'
import { RecentSetAttemptsCard } from '@/features/dashboard/components/recent-set-attempts-card'
import { StatsCard } from '@/features/dashboard/components/stats-card'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { showComingSoonModal } = useComingSoon()
  const { data: progressData, isLoading: progressLoading, error: progressError } = useProgress()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Quick access to your UCAT preparation tools
        </p>
      </div>

      {progressError ? (
        <UcatPagePlaceholder title="Dashboard" description="Could not load your progress data.">
          <p className="text-sm text-destructive">{progressError.message}</p>
        </UcatPagePlaceholder>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {progressLoading ? (
          <Skeleton className="h-[200px] rounded-lg" />
        ) : progressData ? (
          <StatsCard data={progressData} />
        ) : null}
        <NextSessionCard />
      </div>

      {progressData ? (
        <RecentSetAttemptsCard attempts={progressData.setAttempts} />
      ) : progressLoading ? (
        <Skeleton className="h-[240px] rounded-lg" />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboardCards.map((card) => {
          const Icon = card.icon

          if (card.comingSoon) {
            return (
              <button
                key={card.href}
                type="button"
                onClick={() => showComingSoonModal()}
                className={cn(
                  'group relative flex w-full flex-col items-start rounded-lg border bg-card p-6 text-left',
                  'transition-colors hover:bg-accent/50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
                aria-label={`${card.label} (coming soon)`}
              >
                <div className="flex w-full items-start justify-between">
                  <div className="rounded-lg bg-muted/60 p-2.5">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Coming soon
                  </Badge>
                </div>
                <h3 className="mt-4 font-semibold">{card.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
              </button>
            )
          }

          return (
            <Link
              key={card.href}
              href={card.href}
              className={cn(
                'group relative flex w-full flex-col items-start rounded-lg border bg-card p-6 text-left',
                'transition-colors hover:bg-accent/50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <div className="flex w-full items-start justify-between">
                <div className="rounded-lg bg-muted/60 p-2.5">
                  <Icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <h3 className="mt-4 font-semibold">{card.label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
