'use client'

import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@altitutor/ui'
import type { ProgressResponse } from '@/app/api/ucat/progress/route'
import { ChevronRight } from 'lucide-react'

type StatsCardProps = {
  data: ProgressResponse
}

export function StatsCard({ data }: StatsCardProps) {
  const questionsCompleted = data.questionAttempts.length
  const setsCompleted = data.setAttempts.filter(
    (a) => !a.studentUcatMockAttemptId
  ).length
  const mocksCompleted = data.mockAttempts.length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Stats</CardTitle>
        <Link
          href="/progress"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          View progress
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-2xl font-semibold">{questionsCompleted}</p>
            <p className="text-xs text-muted-foreground">Questions completed</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-2xl font-semibold">{setsCompleted}</p>
            <p className="text-xs text-muted-foreground">Sets completed</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-2xl font-semibold">{mocksCompleted}</p>
            <p className="text-xs text-muted-foreground">Mocks completed</p>
          </div>
        </div>
        {data.sectionProgress.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Section avg (EMA)
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {data.sectionProgress.map((section) => (
                <div
                  key={section.sectionId}
                  className="rounded-lg border border-border bg-muted/20 px-3 py-2"
                >
                  <p className="truncate text-xs text-muted-foreground">
                    {section.sectionName}
                  </p>
                  <p className="text-lg font-semibold tabular-nums">
                    {section.weightedAverageScaledScore != null
                      ? Math.round(section.weightedAverageScaledScore)
                      : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
