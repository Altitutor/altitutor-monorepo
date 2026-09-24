'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Input,
  Label,
  SearchableSelect,
} from '@altitutor/ui'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatLearningModuleOrderEditor } from '@/features/ucat/learning-modules/components/UcatLearningModuleOrderEditor'
import type { UcatSectionOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { UcatLearningModuleKind, UcatLearningModuleRow } from '@/features/ucat/learning-modules/types'
import { resolveRootSectionId } from '@/features/ucat/shared/lib/taxonomy-reparent'

type UcatCreateLearningModuleDialogProps = {
  open: boolean
  kind: UcatLearningModuleKind
  title: string
  sectionId: string | null
  parentId: string | null
  isSaving: boolean
  sections: UcatSectionOption[]
  modules: UcatLearningModuleRow[]
  onClose: () => void
  onSave: (orderItems: Array<{ id: string; index: number }>) => void
  onTitleChange: (title: string) => void
  onSectionIdChange: (sectionId: string | null) => void
  onParentIdChange: (parentId: string | null) => void
}

const NEW_MODULE_PLACEHOLDER_ID = '__new_learning_module__'

export function UcatCreateLearningModuleDialog({
  open,
  kind,
  title,
  sectionId,
  parentId,
  isSaving,
  sections,
  modules,
  onClose,
  onSave,
  onTitleChange,
  onSectionIdChange,
  onParentIdChange,
}: UcatCreateLearningModuleDialogProps) {
  const [orderItems, setOrderItems] = useState<Array<{ id: string; index: number }>>([])

  const sectionItems = useMemo(
    () => [
      { id: 'none', name: 'None' },
      ...sections.filter((s): s is typeof s & { id: string } => s.id != null),
    ],
    [sections],
  )
  const selectedSection = sectionItems.find((section) => section.id === (sectionId ?? 'none')) ?? sectionItems[0]

  const taxonomyRows = useMemo(
    () =>
      modules.map((row) => ({
        id: row.id,
        parent_id: row.parent_ucat_learning_module_id,
        section_id: row.ucat_section_id,
      })),
    [modules],
  )
  const folderOptions = useMemo(
    () =>
      modules.filter(
        (row) =>
          row.kind === 'folder' &&
          resolveRootSectionId(taxonomyRows, row.id) === sectionId,
      ),
    [modules, sectionId, taxonomyRows],
  )
  const parentItems = useMemo(
    () => [{ id: 'none', name: 'Root' }, ...folderOptions.map((folder) => ({ id: folder.id, name: folder.title }))],
    [folderOptions],
  )
  const selectedParent = parentItems.find((item) => item.id === (parentId ?? 'none')) ?? parentItems[0]

  useEffect(() => {
    if (!parentId) return
    if (folderOptions.some((folder) => folder.id === parentId)) return
    onParentIdChange(null)
  }, [folderOptions, onParentIdChange, parentId])

  const noun = kind === 'folder' ? 'folder' : 'learning module'
  const orderPlaceholder = useMemo(
    () => ({
      id: NEW_MODULE_PLACEHOLDER_ID,
      title: title.trim() || (kind === 'folder' ? 'New folder' : 'New learning module'),
      kind,
      sectionId,
      parentId,
    }),
    [kind, parentId, sectionId, title],
  )

  return (
    <UcatDialogShell
      open={open}
      onClose={onClose}
      title={kind === 'folder' ? 'New folder' : 'New learning module'}
      subtitle={`Create a ${noun} and choose where it sits in the hierarchy.`}
      onSave={() => onSave(orderItems)}
      saveDisabled={!title.trim()}
      isSaving={isSaving}
      saveLabel={kind === 'folder' ? 'Create folder' : 'Create module'}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden p-6">
        <div className="shrink-0 space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Module title"
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
                  if (nextSectionId !== sectionId) onParentIdChange(null)
                  onSectionIdChange(nextSectionId)
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
                  onParentIdChange(item?.id === 'none' ? null : item?.id ?? null)
                }
                getItemLabel={(folder) => folder.name}
                getItemId={(folder) => folder.id}
                placeholder="Root"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2">
          <Label>Placement</Label>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border p-3">
            <UcatLearningModuleOrderEditor
              moduleId={null}
              sectionId={sectionId}
              modules={modules}
              editorMode="edit"
              placeholder={orderPlaceholder}
              onOrderItemsChange={setOrderItems}
            />
          </div>
        </div>
      </div>
    </UcatDialogShell>
  )
}

export { NEW_MODULE_PLACEHOLDER_ID }
