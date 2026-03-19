'use client'

import Link from 'next/link'
import { Badge, Skeleton } from '@altitutor/ui'
import { ChevronRight } from 'lucide-react'
import { UcatPageHeader } from '@/features/layout'
import { useComingSoon } from '@/features/layout/context/coming-soon-context'
import { AccessUpsellModal } from '@/features/ucat-access/components/access-upsell-modal'
import {
  getUpsellConfigForPath,
  hasAccessForPath,
  type RequiredUcatAccess,
} from '@/features/ucat-access/lib/route-access'
import { useUcatAccess } from '@/features/ucat-access/hooks/use-ucat-access'
import { useProgress } from '@/features/progress/hooks/use-progress'
import { dashboardCards } from '@/features/dashboard/config/dashboard-cards'
import { NextSessionCard } from '@/features/dashboard/components/next-session-card'
import { RecentSetAttemptsCard } from '@/features/dashboard/components/recent-set-attempts-card'
import { StatsCard } from '@/features/dashboard/components/stats-card'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { showComingSoonModal } = useComingSoon()
  const access = useUcatAccess()
  const { data: progressData, isLoading: progressLoading, error: progressError } = useProgress()
  const [upsellOpen, setUpsellOpen] = useState(false)
  const [upsellRequiredAccess, setUpsellRequiredAccess] = useState<RequiredUcatAccess | null>(null)

  const openUpsellForPath = (path: string) => {
    const config = getUpsellConfigForPath(path)
    if (!config) return
    setUpsellRequiredAccess(config.requiredAccess)
    setUpsellOpen(true)
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Dashboard"
        description="Quick access to your UCAT preparation tools"
      />

      {progressError ? (
        <p className="text-sm text-destructive">{progressError.message}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {progressLoading ? (
          <Skeleton className="h-[200px] rounded-lg" />
        ) : progressData ? (
          <StatsCard data={progressData} />
        ) : null}
        {access.hasInPersonAccess ? <NextSessionCard /> : null}
      </div>

      {access.hasOnlineAccess && progressData ? (
        <RecentSetAttemptsCard attempts={progressData.setAttempts} />
      ) : progressLoading ? (
        <Skeleton className="h-[240px] rounded-lg" />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboardCards.map((card) => {
          const Icon = card.icon
          const accessConfig = getUpsellConfigForPath(card.href)
          const blocked = !hasAccessForPath(card.href, access)

          if (card.comingSoon) {
            return (
              <button
                key={card.href}
                type="button"
                onClick={() => showComingSoonModal()}
                className={cn(
                  'group relative flex w-full flex-col items-start rounded-lg border border-border bg-card p-6 text-left',
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

          if (blocked) {
            return (
              <button
                key={card.href}
                type="button"
                onClick={() => openUpsellForPath(card.href)}
                className={cn(
                  'group relative flex w-full flex-col items-start rounded-lg border border-border bg-card p-6 text-left',
                  'transition-colors hover:bg-accent/50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                <div className="flex w-full items-start justify-between">
                  <div className="rounded-lg bg-muted/60 p-2.5">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {accessConfig ? (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {accessConfig.badgeLabel}
                    </Badge>
                  ) : null}
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
                'group relative flex w-full flex-col items-start rounded-lg border border-border bg-card p-6 text-left',
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
      <AccessUpsellModal
        open={upsellOpen}
        requiredAccess={upsellRequiredAccess}
        onOpenChange={(open) => {
          setUpsellOpen(open)
          if (!open) setUpsellRequiredAccess(null)
        }}
      />
    </div>
  )
}
