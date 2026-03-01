'use client'

import { useMemo, useState } from 'react'
import { ListToolbar, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui'
import { formatTime, getDayOfWeek } from '@/shared/utils/datetime'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { useUcatClassesWithDetails } from '@/features/ucat/students/hooks/useUcatStudents'
import type { UcatClassWithDetails } from '@/features/ucat/students/api/students'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatClassDialog } from '@/features/ucat/classes/components/UcatClassDialog'
import { applyCoreStringFilter } from '@/features/ucat/shared/hooks/useUcatTableState'
import { Pencil } from 'lucide-react'

function formatClassTime(c: UcatClassWithDetails): string {
  const day = c.day_of_week != null ? getDayOfWeek(c.day_of_week) : ''
  const start = formatTime(c.start_time ?? undefined)
  const end = formatTime(c.end_time ?? undefined)
  if (!day && !start) return '—'
  return [day, start && end ? `${start} – ${end}` : start || end].filter(Boolean).join(' ')
}

export function UcatClassesPage() {
  const access = useUcatAccess()
  const { data: classes, isLoading } = useUcatClassesWithDetails()
  const [classDialogId, setClassDialogId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const list = classes ?? []
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter((row) => {
      const timeStr = formatClassTime(row)
      const studentNames = row.students.map((s) => [s.first_name, s.last_name].filter(Boolean).join(' ')).join(' ')
      const staffNames = row.staff.map((s) => [s.first_name, s.last_name].filter(Boolean).join(' ')).join(' ')
      return (
        applyCoreStringFilter(timeStr, search) ||
        studentNames.toLowerCase().includes(q) ||
        staffNames.toLowerCase().includes(q)
      )
    })
  }, [classes, search])

  if (access.isLoading || isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="p-6">
      <UcatPageHeader
        title="UCAT Classes"
        description="View UCAT classes and assign sets and mocks to sessions"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Classes' }]}
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search classes"
      />

      <div className="pt-3">
        <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead className="w-16 shrink-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No UCAT classes found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatClassTime(row)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {row.students.length === 0
                        ? '—'
                        : row.students.map((s) => (
                            <span key={s.id}>
                              {[s.first_name, s.last_name].filter(Boolean).join(' ').trim() || 'Student'}
                            </span>
                          ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      {row.staff.length === 0
                        ? '—'
                        : row.staff.map((s) => (
                            <span key={s.id}>
                              {[s.first_name, s.last_name].filter(Boolean).join(' ').trim() || 'Unknown'}
                            </span>
                          ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <UcatRowActions
                      actions={[
                        {
                          label: 'Edit',
                          icon: <Pencil className="h-4 w-4" />,
                          onClick: () => setClassDialogId(row.id),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      <UcatClassDialog
        open={!!classDialogId}
        classId={classDialogId}
        onClose={() => setClassDialogId(null)}
        onSaved={() => setClassDialogId(null)}
      />
    </div>
  )
}
