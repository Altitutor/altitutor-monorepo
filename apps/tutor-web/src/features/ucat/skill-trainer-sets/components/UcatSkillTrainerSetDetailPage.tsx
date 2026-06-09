'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  useToast,
} from '@altitutor/ui'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { UcatAccessDenied, UcatPageHeader } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { TutorPageContainer } from '@/shared/components/layouts'
import { ucatSkillTrainerItemsApi } from '@/features/ucat/skill-trainer/api/items'
import {
  useDeleteUcatSkillTrainerSet,
  useReplaceUcatSkillTrainerSetItems,
  useUcatSkillTrainerSet,
  useUcatSkillTrainerSetItems,
  useUcatSkillTrainers,
  useUpsertUcatSkillTrainerSet,
} from '@/features/ucat/skill-trainer-sets/hooks/useUcatSkillTrainerSets'

export function UcatSkillTrainerSetDetailPage({ setId }: { setId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const access = useUcatAccess()
  const hasUcatAccess = Boolean(access.data)

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

  const { data: availableItems } = useQuery({
    queryKey: ['ucat', 'skill-trainer-items', trainerId],
    queryFn: () =>
      ucatSkillTrainerItemsApi.list({
        trainerKey: trainers?.find((t) => t.id === trainerId)?.key ?? undefined,
      }),
    enabled: hasUcatAccess && !!trainerId,
  })

  const trainerItems = useMemo(
    () => (availableItems ?? []).filter((i) => i.skill_trainer_id === trainerId),
    [availableItems, trainerId]
  )

  useEffect(() => {
    const s = setQuery.data
    if (!s) return
    setTrainerId(s.skill_trainer_id)
    setName(s.name)
    setDescription(s.description ?? '')
    setIsPrivate(s.is_private)
    setSettingsBaseline(
      JSON.stringify({
        trainerId: s.skill_trainer_id,
        name: s.name,
        description: s.description ?? '',
        isPrivate: s.is_private,
      })
    )
  }, [setQuery.data])

  useEffect(() => {
    const ids = (itemsQuery.data ?? []).map((i) => i.skill_trainer_item_id)
    setItemIds(ids)
    setItemsBaseline(JSON.stringify(ids))
  }, [itemsQuery.data])

  const settingsDirty = useMemo(() => {
    return (
      JSON.stringify({ trainerId, name, description, isPrivate }) !== settingsBaseline
    )
  }, [trainerId, name, description, isPrivate, settingsBaseline])

  const itemsDirty = useMemo(() => JSON.stringify(itemIds) !== itemsBaseline, [itemIds, itemsBaseline])

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= itemIds.length) return
    setItemIds((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const handleSaveSettings = async () => {
    if (!name.trim() || !trainerId) return
    try {
      await upsert.mutateAsync({
        setId,
        skillTrainerId: trainerId,
        name: name.trim(),
        description: description.trim() || null,
        isPrivate,
      })
      setSettingsBaseline(JSON.stringify({ trainerId, name: name.trim(), description: description.trim(), isPrivate }))
      toast({ title: 'Settings saved' })
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' })
    }
  }

  const handleSaveItems = async () => {
    try {
      await replaceItems.mutateAsync({ setId, itemIds })
      setItemsBaseline(JSON.stringify(itemIds))
      toast({ title: 'Items saved' })
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this skill trainer set?')) return
    try {
      await deleteSet.mutateAsync(setId)
      router.push('/ucat/skill-trainer-sets')
    } catch (e) {
      toast({ title: 'Delete failed', description: String(e), variant: 'destructive' })
    }
  }

  const itemLabel = (itemId: string) => {
    const row = trainerItems.find((i) => i.id === itemId)
    if (!row) return itemId.slice(0, 8)
    return `${row.trainer_name} (${row.approval_status})`
  }

  if (access.isLoading || setQuery.isLoading) return null
  if (!hasUcatAccess) return <UcatAccessDenied />
  if (!setQuery.data) {
    return (
      <TutorPageContainer>
        <p className="text-muted-foreground">Set not found.</p>
        <Button type="button" variant="link" asChild className="px-0">
          <Link href="/ucat/skill-trainer-sets">Back to list</Link>
        </Button>
      </TutorPageContainer>
    )
  }

  const unusedItems = trainerItems.filter((i) => !itemIds.includes(i.id))

  return (
    <TutorPageContainer>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <UcatPageHeader title={name || 'Skill trainer set'} description="Configure set metadata and ordered items." />
          <div className="flex gap-2">
            <Button type="button" variant="outline" asChild>
              <Link href="/ucat/skill-trainer-sets">Back</Link>
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteSet.isPending}>
              Delete
            </Button>
          </div>
        </div>

        <section className="space-y-4 rounded-2xl border p-6">
          <h2 className="text-lg font-semibold">Settings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Trainer</Label>
              <Select value={trainerId} onValueChange={setTrainerId}>
                <SelectTrigger>
                  <SelectValue />
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
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} id="set-private" />
              <Label htmlFor="set-private">Private</Label>
            </div>
          </div>
          <Button type="button" onClick={handleSaveSettings} disabled={!settingsDirty || upsert.isPending}>
            {upsert.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </section>

        <section className="space-y-4 rounded-2xl border p-6">
          <h2 className="text-lg font-semibold">Items ({itemIds.length})</h2>

          {unusedItems.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {unusedItems.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItemIds((prev) => [...prev, item.id])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add {item.trainer_name}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No more items available for this trainer.</p>
          )}

          <div className="space-y-2">
            {itemIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items in this set yet.</p>
            ) : null}
            {itemIds.map((itemId, idx) => (
              <div key={`${itemId}-${idx}`} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <span className="min-w-0 flex-1 text-sm">
                  {idx + 1}. {itemLabel(itemId)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={idx === 0}
                  onClick={() => moveItem(idx, idx - 1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={idx === itemIds.length - 1}
                  onClick={() => moveItem(idx, idx + 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setItemIds((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" onClick={handleSaveItems} disabled={!itemsDirty || replaceItems.isPending}>
            {replaceItems.isPending ? 'Saving…' : 'Save items'}
          </Button>
        </section>
      </div>
    </TutorPageContainer>
  )
}
