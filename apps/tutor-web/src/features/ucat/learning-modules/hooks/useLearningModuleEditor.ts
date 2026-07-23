'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@altitutor/ui'
import {
  useDeleteUcatLearningModule,
  useReorderUcatLearningModules,
  useReplaceUcatLearningModuleBlocks,
  useUcatLearningModule,
  useUcatLearningModuleBlocks,
  useUcatLearningModules,
  useUpsertUcatLearningModule,
} from '@/features/ucat/learning-modules/hooks/useUcatLearningModules'
import type { UcatLearningModuleKind, UcatLearningModuleStudyPlanPriority } from '@/features/ucat/learning-modules/types'
import type { UcatAccessScope, UcatContentStatus } from '@/features/ucat/shared/types'
import type { LearningModuleIconKey } from '@/features/ucat/learning-modules/lib/learning-module-icons'
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
  const reorderModules = useReorderUcatLearningModules()
  const deleteModule = useDeleteUcatLearningModule()

  const [kind, setKind] = useState<UcatLearningModuleKind>('lesson')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [iconKey, setIconKey] = useState<LearningModuleIconKey>('book-open')
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null)
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
  const [index, setIndex] = useState('0')
  const [accessScope, setAccessScope] = useState<UcatAccessScope>('public')
  const [status, setStatus] = useState<UcatContentStatus>('draft')
  const [studyPlanPriority, setStudyPlanPriority] = useState<UcatLearningModuleStudyPlanPriority>('recommended')
  const [studyPlanCategoryIds, setStudyPlanCategoryIds] = useState<string[]>([])
  const [studyPlanTagIds, setStudyPlanTagIds] = useState<string[]>([])
  const [draftBlocks, setDraftBlocks] = useState<DraftBlock[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [settingsBaseline, setSettingsBaseline] = useState('')
  const [blocksBaseline, setBlocksBaseline] = useState('')

  const allModuleRows = useMemo(() => allModules ?? [], [allModules])
  const folderOptions = useMemo(
    () => allModuleRows.filter((m) => m.kind === 'folder' && m.id !== moduleId),
    [allModuleRows, moduleId],
  )

  useEffect(() => {
    const m = moduleQuery.data
    if (!m) return
    setKind(m.kind)
    setTitle(m.title)
    setDescription(m.description ?? '')
    setIconKey(m.icon_key)
    setEstimatedMinutes(m.estimated_minutes)
    setSectionId(m.ucat_section_id)
    setParentId(m.parent_ucat_learning_module_id)
    setIndex(String(m.index))
    setAccessScope(m.access_scope)
    setStatus(m.status)
    setStudyPlanPriority(m.study_plan_priority)
    setStudyPlanCategoryIds(m.study_plan_category_ids)
    setStudyPlanTagIds(m.study_plan_tag_ids)
    setSettingsBaseline(
      snapshotSettings({
        kind: m.kind,
        title: m.title,
        description: m.description ?? '',
        iconKey: m.icon_key,
        estimatedMinutes: m.estimated_minutes,
        sectionId: m.ucat_section_id,
        parentId: m.parent_ucat_learning_module_id,
        index: m.index,
        accessScope: m.access_scope,
        studyPlanPriority: m.study_plan_priority,
        studyPlanCategoryIds: m.study_plan_category_ids,
        studyPlanTagIds: m.study_plan_tag_ids,
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
      skill_trainer_id: row.skill_trainer_id,
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
      iconKey,
      estimatedMinutes,
      sectionId,
      parentId,
      index: Number(index) || 0,
      accessScope,
      studyPlanPriority,
      studyPlanCategoryIds,
      studyPlanTagIds,
    })
    return current !== settingsBaseline
  }, [kind, title, description, iconKey, estimatedMinutes, sectionId, parentId, index, accessScope, studyPlanPriority, studyPlanCategoryIds, studyPlanTagIds, settingsBaseline])

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

  const insertBlock = useCallback((block: DraftBlock, index: number) => {
    setDraftBlocks((prev) => {
      const next = [...prev]
      const safeIndex = Math.max(0, Math.min(index, next.length))
      next.splice(safeIndex, 0, block)
      return next
    })
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
    if (!moduleId) return
    if (!title.trim()) {
      throw new Error('Title is required before saving')
    }
    await upsert.mutateAsync({
      moduleId,
      kind,
      title: title.trim(),
      description: description.trim() || null,
      iconKey,
      estimatedMinutes,
      ucatSectionId: sectionId,
      parentId,
      index: Number(index) || 0,
      accessScope,
      studyPlanPriority,
      studyPlanCategoryIds,
      studyPlanTagIds,
    })
    setSettingsBaseline(
      snapshotSettings({
        kind,
        title: title.trim(),
        description: description.trim(),
        iconKey,
        estimatedMinutes,
        sectionId,
        parentId,
        index: Number(index) || 0,
        accessScope,
        studyPlanPriority,
        studyPlanCategoryIds,
        studyPlanTagIds,
      }),
    )
    toast({ title: 'Settings saved' })
  }, [
    moduleId,
    title,
    kind,
    description,
    iconKey,
    estimatedMinutes,
    sectionId,
    parentId,
    index,
    accessScope,
    studyPlanPriority,
    studyPlanCategoryIds,
    studyPlanTagIds,
    upsert,
    toast,
  ])

  const saveBlocks = useCallback(async () => {
    if (!moduleId) return
    const validationError = validateBlocksForSave(draftBlocks, { isPublished: status === 'published' })
    if (validationError) {
      throw new Error(validationError)
    }
    const payload = toBlockPayload(draftBlocks)
    await replaceBlocks.mutateAsync({ moduleId, blocks: payload })
    setBlocksBaseline(JSON.stringify(payload))
    toast({ title: 'Blocks saved' })
  }, [moduleId, draftBlocks, status, replaceBlocks, toast])

  const saveAll = useCallback(async () => {
    if (settingsDirty) await saveSettings()
    if (blocksDirty && kind === 'lesson') await saveBlocks()
  }, [settingsDirty, blocksDirty, kind, saveSettings, saveBlocks])

  const saveModuleOrder = useCallback(
    async (items: Array<{ id: string; index: number }>) => {
      await reorderModules.mutateAsync(items)
      const current = items.find((item) => item.id === moduleId)
      if (current) {
        setIndex(String(current.index))
        setSettingsBaseline(
          snapshotSettings({
            kind,
            title: title.trim(),
            description: description.trim(),
            iconKey,
            estimatedMinutes,
            sectionId,
            parentId,
            index: current.index,
            accessScope,
            studyPlanPriority,
            studyPlanCategoryIds,
            studyPlanTagIds,
          }),
        )
      }
      toast({ title: 'Module order saved' })
    },
    [
      moduleId,
      reorderModules,
      kind,
      title,
      description,
      iconKey,
      estimatedMinutes,
      sectionId,
      parentId,
      accessScope,
      studyPlanPriority,
      studyPlanCategoryIds,
      studyPlanTagIds,
      toast,
    ],
  )

  const handleDelete = useCallback(async () => {
    if (!moduleId) return
    await deleteModule.mutateAsync(moduleId)
  }, [moduleId, deleteModule])

  return {
    moduleId,
    moduleQuery,
    blocksQuery,
    allModules: allModuleRows,
    folderOptions,
    kind,
    setKind,
    title,
    setTitle,
    description,
    setDescription,
    iconKey,
    setIconKey,
    estimatedMinutes,
    setEstimatedMinutes,
    sectionId,
    setSectionId,
    parentId,
    setParentId,
    index,
    setIndex,
    accessScope,
    setAccessScope,
    status,
    setStatus,
    studyPlanPriority,
    setStudyPlanPriority,
    studyPlanCategoryIds,
    setStudyPlanCategoryIds,
    studyPlanTagIds,
    setStudyPlanTagIds,
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
    insertBlock,
    removeBlock,
    saveSettings,
    saveBlocks,
    saveModuleOrder,
    saveAll,
    handleDelete,
    isSaving: upsert.isPending || replaceBlocks.isPending || reorderModules.isPending,
    isDeleting: deleteModule.isPending,
  }
}
