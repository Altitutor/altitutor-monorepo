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
  const questionsCompleted = new Set(
    data.questionAttempts.map((a) => a.questionId)
  ).size
  const setsCompleted = data.setAttempts.filter(
    (a) => !a.studentUcatMockAttemptId
  ).length
  const mocksCompleted = data.mockAttempts.length

  return (
    <Card className="border-border">
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
      <CardContent className="space-y-4 min-w-0 overflow-hidden">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-2xl font-semibold tabular-nums">{questionsCompleted}</p>
            <p className="text-xs text-muted-foreground break-words">Questions completed</p>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-2xl font-semibold tabular-nums">{setsCompleted}</p>
            <p className="text-xs text-muted-foreground break-words">Sets completed</p>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-2xl font-semibold tabular-nums">{mocksCompleted}</p>
            <p className="text-xs text-muted-foreground break-words">Mocks completed</p>
          </div>
        </div>
        {data.sectionProgress.length > 0 ? (
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Average section scores
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {data.sectionProgress.map((section) => (
                <div
                  key={section.sectionId}
                  className="min-w-0 rounded-lg border border-border bg-muted/20 px-3 py-2 overflow-hidden"
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
