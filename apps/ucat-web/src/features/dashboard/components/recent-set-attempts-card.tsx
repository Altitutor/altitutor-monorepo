'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui'
import type { SetAttemptRow } from '@/app/api/ucat/progress/route'
import { ChevronRight } from 'lucide-react'

const RECENT_LIMIT = 5

type RecentSetAttemptsCardProps = {
  attempts: SetAttemptRow[]
}

export function RecentSetAttemptsCard({ attempts }: RecentSetAttemptsCardProps) {
  const standaloneAttempts = attempts.filter((a) => !a.studentUcatMockAttemptId)
  const recentAttempts = standaloneAttempts
    .sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt) : new Date(a.attemptedAt)
      const dateB = b.completedAt ? new Date(b.completedAt) : new Date(b.attemptedAt)
      return dateB.getTime() - dateA.getTime()
    })
    .slice(0, RECENT_LIMIT)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Recent set attempts</CardTitle>
        <Link
          href="/progress"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Set</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Scaled score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentAttempts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No submitted set attempts yet
                  </TableCell>
                </TableRow>
              ) : (
                recentAttempts.map((a) => {
                  const dateStr = a.completedAt
                    ? format(new Date(a.completedAt), 'dd MMM yyyy')
                    : format(new Date(a.attemptedAt), 'dd MMM yyyy')
                  const total = a.totalPoints ?? 0
                  const points = a.scorePoints ?? 0
                  const scoreStr = total > 0 ? `${points} / ${total}` : '—'

                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <span className="text-muted-foreground">{dateStr}</span>
                      </TableCell>
                      <TableCell>
                        {a.questionSetName ?? 'Question set'}
                      </TableCell>
                      <TableCell>{scoreStr}</TableCell>
                      <TableCell>{a.scaledScore ?? '—'}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
