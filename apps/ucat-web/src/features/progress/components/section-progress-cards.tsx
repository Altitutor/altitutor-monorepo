'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import { cn } from '@/lib/utils'
import type { SectionProgress } from '@/app/api/ucat/progress/route'

type SectionProgressCardsProps = {
  sections: SectionProgress[]
}

function CircularProgress({
  percentage,
  size = 80,
  strokeWidth = 8,
  className,
}: {
  percentage: number
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div
      className={cn('relative inline-flex', className)}
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
          className="text-primary transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
        {percentage}%
      </span>
    </div>
  )
}

export function SectionProgressCards({ sections }: SectionProgressCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {sections.map((section) => (
        <Card key={section.sectionId} className="rounded-xl border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              {section.sectionName}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <CircularProgress
              percentage={section.percentage}
              className="text-primary"
            />
            <div className="text-sm text-muted-foreground">
              {section.correctScore} / {section.maxScore} correct
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
