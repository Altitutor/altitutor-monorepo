'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@altitutor/ui'
import {
  useDeleteUcatLearningModule,
  useReplaceUcatLearningModuleBlocks,
  useUcatLearningModule,
  useUcatLearningModuleBlocks,
  useUcatLearningModules,
  useUpsertUcatLearningModule,
} from '@/features/ucat/learning-modules/hooks/useUcatLearningModules'
import type {
  UcatLearningModuleDisplayMode,
  UcatLearningModuleKind,
} from '@/features/ucat/learning-modules/types'
import {
  toBlockPayload,
  validateBlocksForSave,
} from '@/features/ucat/learning-modules/lib/block-payload'
import {
  type DraftBlock,
  snapshotSettings,
} from '@/features/ucat/learning-modules/lib/learning-module-editor-types'

export function useLearningModuleEditor(moduleId: string | null) {
  const { toast } = useToast()
  const moduleQuery = useUcatLearningModule(moduleId)
  const blocksQuery = useUcatLearningModuleBlocks(moduleId)
  const { data: allModules } = useUcatLearningModules()

  const upsert = useUpsertUcatLearningModule()
  const replaceBlocks = useReplaceUcatLearningModuleBlocks()
  const deleteModule = useDeleteUcatLearningModule()

  const [kind, setKind] = useState<UcatLearningModuleKind>('lesson')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
  const [index, setIndex] = useState('0')
  const [isPrivate, setIsPrivate] = useState(true)
  const [displayMode, setDisplayMode] = useState<UcatLearningModuleDisplayMode>('stepped')
  const [draftBlocks, setDraftBlocks] = useState<DraftBlock[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [settingsBaseline, setSettingsBaseline] = useState('')
  const [blocksBaseline, setBlocksBaseline] = useState('')

  const folderOptions = useMemo(
    () => (allModules ?? []).filter((m) => m.kind === 'folder' && m.id !== moduleId),
    [allModules, moduleId],
  )

  useEffect(() => {
    const m = moduleQuery.data
    if (!m) return
    setKind(m.kind)
    setTitle(m.title)
    setDescription(m.description ?? '')
    setSectionId(m.ucat_section_id)
    setParentId(m.parent_ucat_learning_module_id)
    setIndex(String(m.index))
    setIsPrivate(m.is_private)
    setDisplayMode(m.display_mode ?? 'stepped')
    setSettingsBaseline(
      snapshotSettings({
        kind: m.kind,
        title: m.title,
        description: m.description ?? '',
        sectionId: m.ucat_section_id,
        parentId: m.parent_ucat_learning_module_id,
        index: m.index,
        isPrivate: m.is_private,
        displayMode: m.display_mode ?? 'stepped',
      }),
    )
  }, [moduleQuery.data])

  useEffect(() => {
    const rows = blocksQuery.data ?? []
    const draft = rows.map((row) => ({
      clientId: row.id,
      block_type: row.block_type,
      require_completion_before_next: row.require_completion_before_next,
      content: (row.content ?? {}) as Record<string, unknown>,
      question_stem_id: row.question_stem_id,
      question_id: row.question_id,
      file_id: row.file_id,
      skill_trainer_set_id: row.skill_trainer_set_id,
    }))
    setDraftBlocks(draft)
    setBlocksBaseline(JSON.stringify(toBlockPayload(draft)))
    setSelectedBlockId((current) => {
      if (current && draft.some((block) => block.clientId === current)) {
        return current
      }
      return draft[0]?.clientId ?? null
    })
  }, [blocksQuery.data])

  const settingsDirty = useMemo(() => {
    const current = snapshotSettings({
      kind,
      title: title.trim(),
      description: description.trim(),
      sectionId,
      parentId,
      index: Number(index) || 0,
      isPrivate,
      displayMode,
    })
    return current !== settingsBaseline
  }, [kind, title, description, sectionId, parentId, index, isPrivate, displayMode, settingsBaseline])

  const blocksDirty = useMemo(
    () => JSON.stringify(toBlockPayload(draftBlocks)) !== blocksBaseline,
    [draftBlocks, blocksBaseline],
  )

  const hasUnsavedChanges = settingsDirty || blocksDirty

  const selectedBlock = useMemo(
    () => draftBlocks.find((b) => b.clientId === selectedBlockId) ?? null,
    [draftBlocks, selectedBlockId],
  )

  const updateBlock = useCallback((clientId: string, patch: Partial<DraftBlock>) => {
    setDraftBlocks((prev) => prev.map((b) => (b.clientId === clientId ? { ...b, ...patch } : b)))
  }, [])

  const moveBlock = useCallback((from: number, to: number) => {
    if (to < 0) return
    setDraftBlocks((prev) => {
      if (to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }, [])

  const addBlock = useCallback((block: DraftBlock) => {
    setDraftBlocks((prev) => [...prev, block])
    setSelectedBlockId(block.clientId)
  }, [])

  const removeBlock = useCallback(
    (clientId: string) => {
      setDraftBlocks((prev) => {
        const next = prev.filter((b) => b.clientId !== clientId)
        if (selectedBlockId === clientId) {
          setSelectedBlockId(next[0]?.clientId ?? null)
        }
        return next
      })
    },
    [selectedBlockId],
  )

  const saveSettings = useCallback(async () => {
    if (!moduleId || !title.trim()) return
    await upsert.mutateAsync({
      moduleId,
      kind,
      title: title.trim(),
      description: description.trim() || null,
      ucatSectionId: sectionId,
      parentId,
      index: Number(index) || 0,
      isPrivate,
      displayMode: kind === 'lesson' ? displayMode : undefined,
    })
    setSettingsBaseline(
      snapshotSettings({
        kind,
        title: title.trim(),
        description: description.trim(),
        sectionId,
        parentId,
        index: Number(index) || 0,
        isPrivate,
        displayMode,
      }),
    )
    toast({ title: 'Settings saved' })
  }, [
    moduleId,
    title,
    kind,
    description,
    sectionId,
    parentId,
    index,
    isPrivate,
    displayMode,
    upsert,
    toast,
  ])

  const saveBlocks = useCallback(async () => {
    if (!moduleId) return
    const validationError = validateBlocksForSave(draftBlocks)
    if (validationError) {
      toast({ title: 'Cannot save blocks', description: validationError, variant: 'destructive' })
      return
    }
    const payload = toBlockPayload(draftBlocks)
    await replaceBlocks.mutateAsync({ moduleId, blocks: payload })
    setBlocksBaseline(JSON.stringify(payload))
    toast({ title: 'Blocks saved' })
  }, [moduleId, draftBlocks, replaceBlocks, toast])

  const saveAll = useCallback(async () => {
    if (settingsDirty) await saveSettings()
    if (blocksDirty && kind === 'lesson') await saveBlocks()
  }, [settingsDirty, blocksDirty, kind, saveSettings, saveBlocks])

  const handleDelete = useCallback(async () => {
    if (!moduleId) return
    await deleteModule.mutateAsync(moduleId)
  }, [moduleId, deleteModule])

  return {
    moduleId,
    moduleQuery,
    blocksQuery,
    folderOptions,
    kind,
    setKind,
    title,
    setTitle,
    description,
    setDescription,
    sectionId,
    setSectionId,
    parentId,
    setParentId,
    index,
    setIndex,
    isPrivate,
    setIsPrivate,
    displayMode,
    setDisplayMode,
    draftBlocks,
    selectedBlockId,
    setSelectedBlockId,
    selectedBlock,
    settingsDirty,
    blocksDirty,
    hasUnsavedChanges,
    updateBlock,
    moveBlock,
    addBlock,
    removeBlock,
    saveSettings,
    saveBlocks,
    saveAll,
    handleDelete,
    isSaving: upsert.isPending || replaceBlocks.isPending,
    isDeleting: deleteModule.isPending,
  }
}
