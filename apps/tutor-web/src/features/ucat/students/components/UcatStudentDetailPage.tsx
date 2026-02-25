'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatStudentMockAttempts, useUcatStudentSetAttempts, useUcatStudentSummary } from '@/features/ucat/students/hooks/useUcatStudents'

export function UcatStudentDetailPage({ studentId }: { studentId: string }) {
  const access = useUcatAccess()
  const summary = useUcatStudentSummary(studentId)
  const setAttempts = useUcatStudentSetAttempts(studentId)
  const mockAttempts = useUcatStudentMockAttempts(studentId)

  if (access.isLoading || summary.isLoading || setAttempts.isLoading || mockAttempts.isLoading) return <UcatPageSkeleton rows={6} />

  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="p-6 space-y-6">
      <UcatPageHeader
        title={summary.data?.student_name ?? 'Student'}
        description="Progress and attempt history"
        backHref="/ucat/students"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Students', href: '/ucat/students' }, { label: 'Detail' }]}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Sets Attempted" value={String(summary.data?.total_sets_attempted ?? 0)} />
        <MetricCard label="Mocks Attempted" value={String(summary.data?.total_mocks_attempted ?? 0)} />
        <MetricCard label="Avg Score" value={summary.data?.avg_score_points?.toFixed?.(2) ?? '-'} />
        <MetricCard label="Avg Scaled" value={summary.data?.avg_scaled_score?.toFixed?.(2) ?? '-'} />
      </div>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Set Attempts</h2>
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Set</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Scaled</TableHead>
                <TableHead>Attempted</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(setAttempts.data ?? []).map((attempt) => (
                <TableRow key={attempt.attempt_id ?? ''}>
                  <TableCell>{JSON.stringify(attempt.set_name ?? '')}</TableCell>
                  <TableCell>
                    {attempt.score_points ?? '-'} / {attempt.total_points ?? '-'}
                  </TableCell>
                  <TableCell>{attempt.scaled_score ?? '-'}</TableCell>
                  <TableCell>{attempt.attempted_at ? new Date(attempt.attempted_at).toLocaleString() : '-'}</TableCell>
                  <TableCell>{attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Mock Attempts</h2>
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mock</TableHead>
                <TableHead>Attempted</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(mockAttempts.data ?? []).map((attempt) => (
                <TableRow key={attempt.id ?? ''}>
                  <TableCell>{attempt.mock_name ?? '-'}</TableCell>
                  <TableCell>{attempt.attempted_at ? new Date(attempt.attempted_at).toLocaleString() : '-'}</TableCell>
                  <TableCell>{attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </article>
  )
}
