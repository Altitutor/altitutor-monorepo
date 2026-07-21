'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/shared/utils'
import type { SectionProgress } from '@altitutor/shared'
import type { ProgressMode } from '../lib/progress-mode'

type SectionProgressCardsProps = {
  sections: SectionProgress[]
  linkToSection?: boolean
  basePath?: string
  mode: ProgressMode
  timeFrameDays: string
  mockRecentWeightedAverage?: number | null
}

export function SectionProgressCards({
  sections,
  linkToSection = false,
  basePath = '',
  mode,
  timeFrameDays: _timeFrameDays,
  mockRecentWeightedAverage = null,
}: SectionProgressCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {sections.map((section) => {
        const score =
          mode === 'weighted'
            ? (section.weightedAverageScaledScore ??
              section.averageScaledScore ??
              null)
            : (section.averageScaledScore ??
              section.weightedAverageScaledScore ??
              null)
        const scorePosition =
          score == null
            ? null
            : Math.max(0, Math.min(100, ((score - 300) / 600) * 100))
        const percentage =
          mode === 'weighted' && section.weightedAveragePercentage != null
            ? Math.round(section.weightedAveragePercentage)
            : section.percentage
        const card = (
          <Card
            className={cn(
              'h-full rounded-2xl border-0 shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10',
              linkToSection &&
                'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
            )}
          >
            <CardHeader
              className={cn('pb-2', linkToSection && 'relative pr-12')}
            >
              <CardTitle className="text-base font-medium">
                {section.sectionName}
              </CardTitle>
              {linkToSection ? (
                <ChevronRight className="absolute right-4 top-6 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Estimated score
                </div>
                <div
                  className={cn(
                    'text-3xl font-bold tabular-nums',
                    score == null && 'text-muted-foreground',
                  )}
                >
                  {score == null ? '—' : Math.round(score)}
                </div>
              </div>
              <div className="space-y-2">
                <div
                  className="relative h-7"
                  aria-label={`Score scale from 300 to 900${score == null ? '' : `, estimate ${Math.round(score)}`}`}
                >
                  <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-muted" />
                  {scorePosition != null ? (
                    <div
                      className="absolute top-1.5 size-4 -translate-x-1/2 rounded-full border-[3px] border-background bg-primary shadow-sm ring-1 ring-primary/35"
                      style={{ left: `${scorePosition}%` }}
                    />
                  ) : null}
                </div>
                <div className="flex justify-between text-[11px] leading-none tabular-nums text-muted-foreground">
                  <span>300</span>
                  <span>900</span>
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-t border-border/50 pt-3 text-xs">
                <span className="text-muted-foreground">Accuracy</span>
                <span className="font-semibold tabular-nums">
                  {percentage}%
                </span>
              </div>
            </CardContent>
          </Card>
        )
        const sectionHref = basePath
          ? `${basePath}/sections/${section.sectionId}`
          : null
        return linkToSection && sectionHref ? (
          <Link
            key={section.sectionId}
            href={sectionHref}
            className="group block"
            aria-label={`View ${section.sectionName} section progress`}
          >
            {card}
          </Link>
        ) : (
          <Fragment key={section.sectionId}>{card}</Fragment>
        )
      })}
      {linkToSection && basePath ? (
        <Link
          href={`${basePath}/mocks`}
          className="group col-span-2 block"
          aria-label="View mock progress"
        >
          <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/[0.06] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:ring-white/10">
            <CardHeader className="relative pr-12">
              <CardTitle className="text-base font-medium">Mocks</CardTitle>
              <ChevronRight className="absolute right-4 top-6 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </CardHeader>
            <CardContent>
              <p className="text-xs font-medium text-muted-foreground">
                Recent-weighted average
              </p>
              <p className="text-3xl font-bold tabular-nums">
                {mockRecentWeightedAverage ?? '—'}
              </p>
            </CardContent>
          </Card>
        </Link>
      ) : null}
    </div>
  )
}
