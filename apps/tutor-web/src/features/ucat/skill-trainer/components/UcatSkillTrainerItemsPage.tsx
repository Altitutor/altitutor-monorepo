'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui'
import { UcatAccessDenied, UcatPageHeader } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { TutorPageContainer } from '@/shared/components/layouts'
import { ucatSkillTrainerItemsApi } from '@/features/ucat/skill-trainer/api/items'

export function UcatSkillTrainerItemsPage() {
  const access = useUcatAccess()
  const hasUcatAccess = Boolean(access.data)
  const [trainerKey, setTrainerKey] = useState<string>('all')
  const [approval, setApproval] = useState<string>('all')

  const { data: trainers } = useQuery({
    queryKey: ['ucat', 'skill-trainers'],
    queryFn: () => ucatSkillTrainerItemsApi.listTrainers(),
    enabled: hasUcatAccess,
  })

  const filters = useMemo(
    () => ({
      trainerKey: trainerKey === 'all' ? undefined : trainerKey,
      approvalStatus:
        approval === 'all' ? undefined : (approval as 'approved' | 'pending' | 'rejected'),
    }),
    [trainerKey, approval]
  )

  const { data: items, isLoading } = useQuery({
    queryKey: ['ucat', 'skill-trainer-items', filters],
    queryFn: () => ucatSkillTrainerItemsApi.list(filters),
    enabled: hasUcatAccess,
  })

  if (access.isLoading) return null
  if (!hasUcatAccess) return <UcatAccessDenied />

  return (
    <TutorPageContainer>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <UcatPageHeader
            title="Skill trainer items"
            description="Author drill content for UCAT skill trainers. New items default to pending approval."
          />
          <Button type="button" asChild>
            <Link href="/ucat/skill-trainer/new">New item</Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={trainerKey} onValueChange={setTrainerKey}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Trainer type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trainers</SelectItem>
              {(trainers ?? []).map((t) => (
                <SelectItem key={t.id} value={t.key ?? ''}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={approval} onValueChange={setApproval}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Approval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trainer</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Link href={`/ucat/skill-trainer/${item.id}`} className="font-medium hover:underline">
                    {item.trainer_name}
                  </Link>
                </TableCell>
                <TableCell className="capitalize">{item.approval_status}</TableCell>
                <TableCell>{item.is_active ? 'Yes' : 'No'}</TableCell>
                <TableCell>{new Date(item.updated_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TutorPageContainer>
  )
}
