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
  useUcatLearningModules,
  useUpsertUcatLearningModule,
} from '@/features/ucat/learning-modules/hooks/useUcatLearningModules'
import type { UcatLearningModuleKind } from '@/features/ucat/learning-modules/types'

export function UcatLearningModulesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const access = useUcatAccess()
  const hasUcatAccess = Boolean(access.data)
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newKind, setNewKind] = useState<UcatLearningModuleKind>('lesson')
  const [newTitle, setNewTitle] = useState('')

  const kind = kindFilter === 'all' ? undefined : (kindFilter as UcatLearningModuleKind)
  const { data: modules, isLoading } = useUcatLearningModules({ kind })
  const upsert = useUpsertUcatLearningModule()

  const folderOptions = useMemo(
    () => (modules ?? []).filter((m) => m.kind === 'folder'),
    [modules]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return modules ?? []
    return (modules ?? []).filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.section_name ?? '').toLowerCase().includes(q) ||
        (m.description ?? '').toLowerCase().includes(q)
    )
  }, [modules, search])

  const folderTitle = (parentId: string | null) => {
    if (!parentId) return '—'
    return folderOptions.find((f) => f.id === parentId)?.title ?? parentId.slice(0, 8)
  }

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    try {
      const id = await upsert.mutateAsync({
        kind: newKind,
        title: newTitle.trim(),
        displayMode: newKind === 'lesson' ? 'stepped' : undefined,
      })
      setCreateOpen(false)
      setNewTitle('')
      router.push(`/ucat/learning-modules/${id}`)
    } catch (e) {
      toast({ title: 'Failed to create module', description: String(e), variant: 'destructive' })
    }
  }

  if (access.isLoading) return null
  if (!hasUcatAccess) return <UcatAccessDenied />

  return (
    <TutorPageContainer>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <UcatPageHeader
            title="Learning modules"
            description="Organise UCAT lessons and folders. Lessons contain blocks students complete in class or online."
          />
          <Button type="button" onClick={() => setCreateOpen(true)}>
            New module
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input
            className="max-w-xs"
            placeholder="Search title or section…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              <SelectItem value="folder">Folders</SelectItem>
              <SelectItem value="lesson">Lessons</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Parent folder</TableHead>
              <TableHead>Contents</TableHead>
              <TableHead>Private</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/ucat/learning-modules/${row.id}`} className="font-medium hover:underline">
                    {row.title}
                  </Link>
                </TableCell>
                <TableCell className="capitalize">{row.kind}</TableCell>
                <TableCell>
                  {row.section_number != null ? `${row.section_number}. ${row.section_name ?? ''}` : '—'}
                </TableCell>
                <TableCell>{folderTitle(row.parent_ucat_learning_module_id)}</TableCell>
                <TableCell>
                  {row.kind === 'folder' ? `${row.child_count} children` : `${row.block_count} blocks`}
                </TableCell>
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
        title="New learning module"
        subtitle="Choose folder or lesson. You can configure section, parent folder, and blocks on the next screen."
        onSave={handleCreate}
        saveDisabled={!newTitle.trim() || upsert.isPending}
        isSaving={upsert.isPending}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Kind</Label>
            <Select value={newKind} onValueChange={(v) => setNewKind(v as UcatLearningModuleKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="folder">Folder</SelectItem>
                <SelectItem value="lesson">Lesson</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Module title" />
          </div>
        </div>
      </UcatDialogShell>
    </TutorPageContainer>
  )
}
