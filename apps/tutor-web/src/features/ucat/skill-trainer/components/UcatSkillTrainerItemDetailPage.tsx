'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
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
} from '@altitutor/ui'
import { UcatAccessDenied, UcatPageHeader } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import { TutorPageContainer } from '@/shared/components/layouts'
import { ucatSkillTrainerItemsApi } from '@/features/ucat/skill-trainer/api/items'
import type { UcatSkillTrainerKey } from '@altitutor/shared'

function defaultContentForKey(key: UcatSkillTrainerKey): Record<string, unknown> {
  switch (key) {
    case 'find_word':
      return {
        passage: plainTextToProseMirror(''),
        keywords: [{ id: 'k1', text: 'keyword', target_sentence_index: 0 }],
      }
    case 'find_concept':
      return { passage: plainTextToProseMirror(''), concept: 'theme', occurrences: [{ start: 0, end: 5 }] }
    case 'quick_syllogism':
      return { statement: 'All A are B.', answer: true }
    case 'mental_maths':
      return { expression: '12 + 8', answer: 20 }
    case 'numpad_speed':
      return { button_sequence: ['7', '+', '3', '='], label: '7 + 3' }
    case 'calculator_maths':
      return { expression: '15 × 4', answer: 60 }
  }
}

export function UcatSkillTrainerItemDetailPage({ itemId }: { itemId: string }) {
  const router = useRouter()
  const isNew = itemId === 'new'
  const access = useUcatAccess()
  const hasUcatAccess = Boolean(access.data)

  const { data: trainers } = useQuery({
    queryKey: ['ucat', 'skill-trainers'],
    queryFn: () => ucatSkillTrainerItemsApi.listTrainers(),
    enabled: hasUcatAccess,
  })

  const { data: item } = useQuery({
    queryKey: ['ucat', 'skill-trainer-item', itemId],
    queryFn: () => ucatSkillTrainerItemsApi.get(itemId),
    enabled: hasUcatAccess && !isNew,
  })

  const [trainerId, setTrainerId] = useState('')
  const [trainerKey, setTrainerKey] = useState<UcatSkillTrainerKey>('quick_syllogism')
  const [contentJson, setContentJson] = useState('{}')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (item) {
      setTrainerId(item.skill_trainer_id)
      setTrainerKey(item.trainer_key as UcatSkillTrainerKey)
      setContentJson(JSON.stringify(item.content, null, 2))
      setIsActive(item.is_active)
    } else if (isNew && trainers?.[0]?.id && trainers[0].key) {
      setTrainerId(trainers[0].id)
      setTrainerKey(trainers[0].key as UcatSkillTrainerKey)
      setContentJson(JSON.stringify(defaultContentForKey(trainers[0].key as UcatSkillTrainerKey), null, 2))
    }
  }, [item, isNew, trainers])

  function handleTrainerChange(id: string) {
    setTrainerId(id)
    const trainer = trainers?.find((t) => t.id === id)
    if (trainer) {
      const key = trainer.key as UcatSkillTrainerKey
      setTrainerKey(key)
      setContentJson(JSON.stringify(defaultContentForKey(key), null, 2))
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const content = JSON.parse(contentJson) as Record<string, unknown>
      const id = await ucatSkillTrainerItemsApi.upsert({
        itemId: isNew ? null : itemId,
        skillTrainerId: trainerId,
        content,
        isActive,
      })
      router.push(`/ucat/skill-trainer/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleApproval(status: 'approved' | 'pending' | 'rejected') {
    if (isNew) return
    await ucatSkillTrainerItemsApi.setApproval(itemId, status)
    router.refresh()
  }

  if (access.isLoading) return null
  if (!hasUcatAccess) return <UcatAccessDenied />

  return (
    <TutorPageContainer>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/ucat/skill-trainer" className="text-sm text-muted-foreground hover:underline">
          ← Skill trainer items
        </Link>
        <UcatPageHeader
          title={isNew ? 'New skill trainer item' : 'Edit skill trainer item'}
          description={`Trainer: ${trainerKey}`}
        />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Trainer type</Label>
            <Select value={trainerId} onValueChange={handleTrainerChange} disabled={!isNew}>
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

          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="is-active" />
            <Label htmlFor="is-active">Active in bank when approved</Label>
          </div>

          <div className="space-y-2">
            <Label>Content (JSON)</Label>
            <Textarea
              value={contentJson}
              onChange={(e) => setContentJson(e.target.value)}
              rows={18}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              VR: passage (ProseMirror JSON), keywords with target_sentence_index, or concept with char offsets.
            </p>
          </div>

          {!isNew && item ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void handleApproval('approved')}>
                Approve
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleApproval('pending')}>
                Mark pending
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleApproval('rejected')}>
                Reject
              </Button>
              <span className="text-sm text-muted-foreground self-center capitalize">
                Current: {item.approval_status}
              </span>
            </div>
          ) : null}

          <div className="flex gap-3">
            <Button type="button" onClick={() => void handleSave()} disabled={saving || !trainerId}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {error ? <p className="text-sm text-destructive self-center">{error}</p> : null}
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Quick passage plain text (updates JSON passage only)</Label>
            <div className="flex gap-2">
              <Input id="passage-plain" placeholder="Paste passage text" />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const el = document.getElementById('passage-plain') as HTMLInputElement | null
                  const text = el?.value ?? ''
                  try {
                    const parsed = JSON.parse(contentJson) as Record<string, unknown>
                    parsed.passage = plainTextToProseMirror(text)
                    setContentJson(JSON.stringify(parsed, null, 2))
                  } catch {
                    setError('Invalid content JSON')
                  }
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TutorPageContainer>
  )
}
