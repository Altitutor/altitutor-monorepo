'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useToast } from '@altitutor/ui'
import { ucatSkillTrainerItemsApi } from '@/features/ucat/skill-trainer/api/items'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import {
  useDeleteUcatSkillTrainerSet,
  useReplaceUcatSkillTrainerSetItems,
  useUcatSkillTrainerSet,
  useUcatSkillTrainerSetItems,
  useUcatSkillTrainers,
  useUpsertUcatSkillTrainerSet,
} from '@/features/ucat/skill-trainer-sets/hooks/useUcatSkillTrainerSets'

function snapshotSettings(values: {
  trainerId: string
  name: string
  description: string
  isPrivate: boolean
}) {
  return JSON.stringify(values)
}

export function useSkillTrainerSetEditor(setId: string | null) {
  const { toast } = useToast()
  const setQuery = useUcatSkillTrainerSet(setId)
  const itemsQuery = useUcatSkillTrainerSetItems(setId)
  const { data: trainers } = useUcatSkillTrainers()

  const upsert = useUpsertUcatSkillTrainerSet()
  const replaceItems = useReplaceUcatSkillTrainerSetItems()
  const deleteSet = useDeleteUcatSkillTrainerSet()

  const [trainerId, setTrainerId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [itemIds, setItemIds] = useState<string[]>([])
  const [settingsBaseline, setSettingsBaseline] = useState('')
  const [itemsBaseline, setItemsBaseline] = useState('')

  const trainerKey = useMemo(
    () => trainers?.find((t) => t.id === trainerId)?.key,
    [trainers, trainerId],
  )

  const { data: availableItems, refetch: refetchTrainerItems } = useQuery({
    queryKey: ucatKeys.skillTrainerItems(trainerKey),
    queryFn: () => ucatSkillTrainerItemsApi.list({ trainerKey }),
    enabled: !!setId && !!trainerKey,
  })

  const trainerItems = useMemo(
    () => (availableItems ?? []).filter((i) => i.skill_trainer_id === trainerId),
    [availableItems, trainerId],
  )

  const unusedItems = useMemo(
    () => trainerItems.filter((i) => !itemIds.includes(i.id)),
    [trainerItems, itemIds],
  )

  useEffect(() => {
    const s = setQuery.data
    if (!s) return
    setTrainerId(s.skill_trainer_id)
    setName(s.name)
    setDescription(s.description ?? '')
    setIsPrivate(s.is_private)
    setSettingsBaseline(
      snapshotSettings({
        trainerId: s.skill_trainer_id,
        name: s.name,
        description: s.description ?? '',
        isPrivate: s.is_private,
      }),
    )
  }, [setQuery.data])

  useEffect(() => {
    const ids = (itemsQuery.data ?? []).map((i) => i.skill_trainer_item_id)
    setItemIds(ids)
    setItemsBaseline(JSON.stringify(ids))
  }, [itemsQuery.data])

  const settingsDirty = useMemo(() => {
    return (
      snapshotSettings({ trainerId, name: name.trim(), description: description.trim(), isPrivate }) !==
      settingsBaseline
    )
  }, [trainerId, name, description, isPrivate, settingsBaseline])

  const itemsDirty = useMemo(() => JSON.stringify(itemIds) !== itemsBaseline, [itemIds, itemsBaseline])
  const hasUnsavedChanges = settingsDirty || itemsDirty

  const addItem = useCallback((itemId: string) => {
    setItemIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]))
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItemIds((prev) => prev.filter((id) => id !== itemId))
  }, [])

  const saveSettings = useCallback(async () => {
    if (!setId || !name.trim() || !trainerId) return
    await upsert.mutateAsync({
      setId,
      skillTrainerId: trainerId,
      name: name.trim(),
      description: description.trim() || null,
      isPrivate,
    })
    setSettingsBaseline(
      snapshotSettings({
        trainerId,
        name: name.trim(),
        description: description.trim(),
        isPrivate,
      }),
    )
    toast({ title: 'Settings saved' })
  }, [setId, name, trainerId, description, isPrivate, upsert, toast])

  const saveItems = useCallback(async () => {
    if (!setId) return
    await replaceItems.mutateAsync({ setId, itemIds })
    setItemsBaseline(JSON.stringify(itemIds))
    toast({ title: 'Items saved' })
  }, [setId, itemIds, replaceItems, toast])

  const saveAll = useCallback(async () => {
    if (settingsDirty) await saveSettings()
    if (itemsDirty) await saveItems()
  }, [settingsDirty, itemsDirty, saveSettings, saveItems])

  const handleDelete = useCallback(async () => {
    if (!setId) return
    await deleteSet.mutateAsync(setId)
  }, [setId, deleteSet])

  return {
    setQuery,
    itemsQuery,
    trainers: trainers ?? [],
    trainerId,
    setTrainerId,
    name,
    setName,
    description,
    setDescription,
    isPrivate,
    setIsPrivate,
    itemIds,
    setItemIds,
    trainerItems,
    unusedItems,
    refetchTrainerItems,
    addItem,
    removeItem,
    settingsDirty,
    itemsDirty,
    hasUnsavedChanges,
    saveAll,
    handleDelete,
    isSaving: upsert.isPending || replaceItems.isPending,
    isDeleting: deleteSet.isPending,
  }
}
