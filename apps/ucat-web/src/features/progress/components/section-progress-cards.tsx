'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import { cn } from '@/lib/utils'
import { SegmentedControl } from './segmented-control'
import type { SectionProgress } from '@/app/api/ucat/progress/route'

type SectionProgressCardsProps = {
  sections: SectionProgress[]
  /** When true, cards link to section detail page */
  linkToSection?: boolean
}

function CircularProgress({
  percentage,
  correct,
  total,
  showQuestionsCompletedOnly = false,
  size = 120,
  strokeWidth = 10,
  className,
}: {
  percentage: number
  correct: number
  total: number
  /** When true, show "{total} questions completed" instead of "{correct} / {total}" */
  showQuestionsCompletedOnly?: boolean
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  const sublabel = showQuestionsCompletedOnly
    ? `${total} questions completed`
    : `${correct} / ${total}`

  return (
    <div
      className={cn('relative inline-flex flex-col items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        aria-label={`${percentage}% progress`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-accent transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold tabular-nums">{percentage}%</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {sublabel}
        </span>
      </div>
    </div>
  )
}

type ScaledScoreMode = 'average' | 'weighted'

export function SectionProgressCards({
  sections,
  linkToSection = false,
}: SectionProgressCardsProps) {
  const [scaledScoreMode, setScaledScoreMode] =
    useState<ScaledScoreMode>('weighted')

  const getScaledScore = (section: SectionProgress): number | null =>
    scaledScoreMode === 'average'
      ? section.averageScaledScore
      : section.weightedAverageScaledScore

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SegmentedControl
          value={scaledScoreMode}
          onValueChange={(v) => setScaledScoreMode(v as ScaledScoreMode)}
          options={[
            { value: 'average', label: 'All time' },
            {
              value: 'weighted',
              label: 'Weighted average',
              infoTooltip:
                'Recent attempts are weighted more heavily than older ones, giving a better picture of your current performance.',
            },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => {
          const score = getScaledScore(section)
          const card = (
            <Card
              key={section.sectionId}
              className={cn(
                'rounded-xl border-border',
                linkToSection && 'transition-colors hover:bg-muted/50'
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  {section.sectionName}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Scaled score
                  </div>
                  <div
                    className={cn(
                      'text-3xl font-bold tabular-nums',
                      score == null && 'text-muted-foreground'
                    )}
                  >
                    {score != null ? Math.round(score) : '—'}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Percentage correct
                  </div>
                  <CircularProgress
                    percentage={
                      scaledScoreMode === 'weighted' &&
                      section.weightedAveragePercentage != null
                        ? Math.round(section.weightedAveragePercentage)
                        : section.percentage
                    }
                    correct={section.correctScore}
                    total={section.maxScore}
                    showQuestionsCompletedOnly={scaledScoreMode === 'weighted'}
                    className="text-accent"
                  />
                </div>
              </CardContent>
            </Card>
          )
          return linkToSection ? (
            <Link key={section.sectionId} href={`/progress/${section.sectionId}`}>
              {card}
            </Link>
          ) : (
            card
          )
        })}
      </div>
    </div>
  )
}
