'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@altitutor/ui'
import { UcatAccessDenied, UcatPageHeader } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { TutorPageContainer } from '@/shared/components/layouts'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import {
  useUcatSkillTrainerSets,
  useUcatSkillTrainers,
  useUpsertUcatSkillTrainerSet,
} from '@/features/ucat/skill-trainer-sets/hooks/useUcatSkillTrainerSets'

export function UcatSkillTrainerSetsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const access = useUcatAccess()
  const hasUcatAccess = Boolean(access.data)
  const [trainerKey, setTrainerKey] = useState('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTrainerId, setNewTrainerId] = useState('')

  const filterKey = trainerKey === 'all' ? undefined : trainerKey
  const { data: sets, isLoading } = useUcatSkillTrainerSets({ trainerKey: filterKey })
  const { data: trainers } = useUcatSkillTrainers()
  const upsert = useUpsertUcatSkillTrainerSet()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sets ?? []
    return (sets ?? []).filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.trainer_name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
    )
  }, [sets, search])

  const handleCreate = async () => {
    if (!newName.trim() || !newTrainerId) return
    try {
      const id = await upsert.mutateAsync({
        skillTrainerId: newTrainerId,
        name: newName.trim(),
      })
      setCreateOpen(false)
      setNewName('')
      router.push(`/ucat/skill-trainer-sets/${id}`)
    } catch (e) {
      toast({ title: 'Failed to create set', description: String(e), variant: 'destructive' })
    }
  }

  if (access.isLoading) return null
  if (!hasUcatAccess) return <UcatAccessDenied />

  return (
    <TutorPageContainer>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <UcatPageHeader
            title="Skill trainer sets"
            description="Curated bundles of skill trainer items for use in lessons or drills."
          />
          <Button
            type="button"
            onClick={() => {
              setCreateOpen(true)
              if (trainers?.[0]?.id) setNewTrainerId(trainers[0].id)
            }}
          >
            New set
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input
            className="max-w-xs"
            placeholder="Search name or trainer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={trainerKey} onValueChange={setTrainerKey}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Trainer" />
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
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Trainer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Private</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/ucat/skill-trainer-sets/${row.id}`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell>{row.trainer_name}</TableCell>
                <TableCell>{row.item_count}</TableCell>
                <TableCell>{row.is_private ? 'Yes' : 'No'}</TableCell>
                <TableCell>{row.updated_at ? new Date(row.updated_at).toLocaleDateString() : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <UcatDialogShell
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New skill trainer set"
        subtitle="Pick a trainer type, then add items on the detail page."
        onSave={handleCreate}
        saveDisabled={!newName.trim() || !newTrainerId || upsert.isPending}
        isSaving={upsert.isPending}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Trainer</Label>
            <Select value={newTrainerId} onValueChange={setNewTrainerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select trainer" />
              </SelectTrigger>
              <SelectContent>
                {(trainers ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id ?? ''}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Set name" />
          </div>
        </div>
      </UcatDialogShell>
    </TutorPageContainer>
  )
}
