'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
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
import { ProgressTablePagination } from './progress-table-pagination'
import { format } from 'date-fns'
import { filterByTimeFrame } from '../lib/progress-data-utils'
import type { PracticeAttemptRow } from '@/app/api/ucat/progress/route'
import type { ProgressMode, TimeFrameDays } from '../lib/progress-mode'

type PracticeAttemptsCardProps = {
  attempts: PracticeAttemptRow[]
  mode: ProgressMode
  timeFrameDays: TimeFrameDays
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export function PracticeAttemptsCard({
  attempts,
  mode,
  timeFrameDays,
}: PracticeAttemptsCardProps) {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filteredAttempts = useMemo(
    () => filterByTimeFrame(attempts, mode, timeFrameDays),
    [attempts, mode, timeFrameDays]
  )

  const paginatedAttempts = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredAttempts.slice(start, start + pageSize)
  }, [filteredAttempts, page, pageSize])

  if (filteredAttempts.length === 0) {
    return null
  }

  return (
    <Card className="rounded-xl border-border">
      <CardHeader>
        <CardTitle>Practice sessions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAttempts.map((a) => {
              const score =
                a.totalPoints != null &&
                a.totalPoints > 0 &&
                a.scorePoints != null
                  ? `${a.scorePoints} / ${a.totalPoints}`
                  : '—'
              const date = a.completedAt ?? a.attemptedAt
              return (
                <TableRow
                  key={a.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/progress/practice-sessions/${a.id}`)}
                >
                  <TableCell className="font-medium">
                    {a.sectionName}
                    {a.unlimited ? ' (unlimited)' : ''}
                  </TableCell>
                  <TableCell>{score}</TableCell>
                  <TableCell>{a.questionCount ?? '—'}</TableCell>
                  <TableCell>{date ? format(new Date(date), 'PPp') : '—'}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <ProgressTablePagination
          total={filteredAttempts.length}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </CardContent>
    </Card>
  )
}
