'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Input,
  Label,
  SearchableSelect,
  Textarea,
  useToast,
} from '@altitutor/ui'
import { Trash2 } from 'lucide-react'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { useUcatLearningModule, useUpsertUcatLearningModule } from '@/features/ucat/learning-modules/hooks/useUcatLearningModules'
import type { UcatLearningModuleRow } from '@/features/ucat/learning-modules/types'
import type { UcatSectionOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { isDescendantOf, resolveRootSectionId } from '@/features/ucat/shared/lib/taxonomy-reparent'
import { lifecycleErrorToast } from '@/features/ucat/shared/lifecycle-errors'
import { useRouter } from 'next/navigation'

type UcatLearningModuleFolderDialogProps = {
  open: boolean
  folderId: string | null
  modules: UcatLearningModuleRow[]
  sections: UcatSectionOption[]
  onClose: () => void
  onDelete?: (folderId: string) => Promise<void>
}

export function UcatLearningModuleFolderDialog({
  open,
  folderId,
  modules,
  sections,
  onClose,
  onDelete,
}: UcatLearningModuleFolderDialogProps) {
  const { toast } = useToast()
  const router = useRouter()
  const folderQuery = useUcatLearningModule(open ? folderId : null)
  const upsert = useUpsertUcatLearningModule()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const folder = folderQuery.data
    if (!folder || folder.kind !== 'folder') return
    setTitle(folder.title)
    setDescription(folder.description ?? '')
    setSectionId(folder.ucat_section_id)
    setParentId(folder.parent_ucat_learning_module_id)
  }, [folderQuery.data, open])

  const taxonomyRows = useMemo(
    () =>
      modules.map((row) => ({
        id: row.id,
        parent_id: row.parent_ucat_learning_module_id,
        section_id: row.ucat_section_id,
      })),
    [modules],
  )

  const sectionItems = useMemo(
    () => [
      { id: 'none', name: 'None' },
      ...sections.filter((section): section is typeof section & { id: string } => section.id != null),
    ],
    [sections],
  )
  const selectedSection =
    sectionItems.find((section) => section.id === (sectionId ?? 'none')) ?? sectionItems[0]

  const folderOptions = useMemo(
    () =>
      modules.filter((row) => {
        if (row.kind !== 'folder') return false
        if (folderId && row.id === folderId) return false
        if (folderId && isDescendantOf(taxonomyRows, row.id, folderId)) return false
        return resolveRootSectionId(taxonomyRows, row.id) === sectionId
      }),
    [folderId, modules, sectionId, taxonomyRows],
  )
  const parentItems = useMemo(
    () => [{ id: 'none', name: 'Root' }, ...folderOptions.map((folder) => ({ id: folder.id, name: folder.title }))],
    [folderOptions],
  )
  const selectedParent = parentItems.find((item) => item.id === (parentId ?? 'none')) ?? parentItems[0]

  useEffect(() => {
    if (!parentId) return
    if (folderOptions.some((folder) => folder.id === parentId)) return
    setParentId(null)
  }, [folderOptions, parentId])

  const folder = folderQuery.data
  const isFolder = folder?.kind === 'folder'
  const canSave = Boolean(folderId && isFolder && title.trim())

  async function handleSave() {
    if (!folderId || !folder || folder.kind !== 'folder' || !title.trim()) return
    try {
      await upsert.mutateAsync({
        moduleId: folderId,
        kind: 'folder',
        title: title.trim(),
        description: description.trim() || null,
        ucatSectionId: sectionId,
        parentId,
        index: folder.index,
        accessScope: 'public',
      })
      toast({ title: 'Folder saved', description: title.trim() })
      onClose()
    } catch (error) {
      toast(lifecycleErrorToast(error, 'Could not save folder', router.push))
    }
  }

  async function handleDelete() {
    if (!folderId || !onDelete) return
    await onDelete(folderId)
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={onClose}
      title={title.trim() || folder?.title || 'Folder'}
      subtitle="Edit folder properties and where it sits in the hierarchy."
      onSave={() => void handleSave()}
      saveDisabled={!canSave || upsert.isPending || folderQuery.isLoading}
      isSaving={upsert.isPending}
      saveLabel="Save folder"
      headerActions={
        onDelete ? (
          <UcatRowActions
            actions={[
              {
                label: 'Delete',
                icon: <Trash2 className="h-4 w-4" />,
                onClick: () => void handleDelete(),
                destructive: true,
              },
            ]}
          />
        ) : null
      }
    >
      <div className="space-y-4 p-6">
        {!isFolder && folderQuery.isFetched ? (
          <p className="text-sm text-muted-foreground">This item is not a folder.</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="folder-title">Title</Label>
              <Input
                id="folder-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Folder title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-description">Description</Label>
              <Textarea
                id="folder-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="min-h-20"
                placeholder="Optional description"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Section</Label>
                <SearchableSelect<{ id: string; name: string | null }>
                  items={sectionItems}
                  value={selectedSection}
                  onValueChange={(item) => {
                    const nextSectionId = item?.id === 'none' ? null : item?.id ?? null
                    if (nextSectionId !== sectionId) setParentId(null)
                    setSectionId(nextSectionId)
                  }}
                  getItemLabel={(section) => section.name ?? 'None'}
                  getItemId={(section) => section.id}
                  placeholder="Select section"
                />
              </div>
              <div className="space-y-2">
                <Label>Parent folder</Label>
                <SearchableSelect<{ id: string; name: string }>
                  items={parentItems}
                  value={selectedParent}
                  onValueChange={(item) =>
                    setParentId(item?.id === 'none' ? null : item?.id ?? null)
                  }
                  getItemLabel={(item) => item.name}
                  getItemId={(item) => item.id}
                  placeholder="Root"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Folders organise lessons. Child lessons inherit this folder&apos;s place in the
              hierarchy.
            </p>
          </>
        )}
      </div>
    </UcatDialogShell>
  )
}
