'use client'

import { useMemo, useState } from 'react'
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Json } from '@altitutor/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  SearchableSelect,
  useToast,
} from '@altitutor/ui'
import { Plus } from 'lucide-react'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { SetStatusSpan } from '@/features/ucat/shared/components/SetStatusSpan'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import {
  getSetAddStemWarning,
  getSetSectionStatus,
  parseSetSections,
  type UcatSectionForStatus,
} from '@/features/ucat/shared/lib/set-section-status'
import { tutorBtnOutline } from '@/shared/lib/tutor-visual'

type StaffSetOption = {
  id: string
  name: string
  questionCount: number | null
  sectionCount: number
  firstSectionNumber: number | null
  timeLimitSeconds: number | null
  sections: unknown
}

function formatSetQuestionCount(count: number | null): string {
  if (count == null) return 'Question count unknown'
  return count === 1 ? '1 question' : `${count} questions`
}

function SetQuestionCountSubtitle({
  set,
  sections,
}: {
  set: StaffSetOption
  sections: UcatSectionForStatus[]
}) {
  const status = getSetSectionStatus(
    {
      sectionCount: set.sectionCount,
      firstSectionNumber: set.firstSectionNumber,
      question_count: set.questionCount,
      time_limit_seconds: set.timeLimitSeconds,
    },
    sections,
  )

  return (
    <SetStatusSpan
      status={status.questionCountStatus}
      tooltip={status.questionCountTooltip}
      className="text-xs"
    >
      {formatSetQuestionCount(set.questionCount)}
    </SetStatusSpan>
  )
}

export function UcatStemSetMembershipCard({
  stemId,
  stemSectionId,
  highlighted = false,
}: {
  stemId: string | null | undefined
  stemSectionId: string
  highlighted?: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const setsQuery = useUcatSets()
  const sectionsQuery = useUcatSections()
  const sections = sectionsQuery.data ?? []
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<StaffSetOption | null>(null)
  const [addWarning, setAddWarning] = useState<{
    setId: string
    title: string
    description: string
  } | null>(null)

  const staffSets = useMemo(
    () =>
      (setsQuery.data ?? [])
        .filter((set) => set.id && !set.deleted_at)
        .map((set) => {
          const parsed = parseSetSections(set.sections ?? null)
          return {
            id: set.id as string,
            name: proseMirrorToPlainText(set.name as Json | undefined) || 'Untitled',
            questionCount: set.question_count ?? null,
            sectionCount: parsed.sectionCount,
            firstSectionNumber: parsed.firstSectionNumber,
            timeLimitSeconds: set.time_limit_seconds ?? null,
            sections: set.sections ?? null,
          }
        }),
    [setsQuery.data],
  )

  const setDetailQueries = useQueries({
    queries: staffSets.map((set) => ({
      queryKey: ucatKeys.set(set.id),
      queryFn: () => ucatSetsApi.detail(set.id),
      enabled: !!stemId,
    })),
  })

  const currentSetIds = useMemo(() => {
    if (!stemId) return new Set<string>()
    const ids = new Set<string>()
    staffSets.forEach((set, index) => {
      const detail = setDetailQueries[index]?.data
      const stems = (detail?.stems as Array<{ stem_id: string }> | null) ?? []
      if (stems.some((stem) => stem.stem_id === stemId)) ids.add(set.id)
    })
    return ids
  }, [staffSets, setDetailQueries, stemId])

  const currentSets = staffSets.filter((set) => currentSetIds.has(set.id))
  const addableSets = staffSets.filter((set) => !currentSetIds.has(set.id))

  const invalidateMembership = async (setId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ucatKeys.sets() }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() }),
      setId ? queryClient.invalidateQueries({ queryKey: ucatKeys.set(setId) }) : Promise.resolve(),
    ])
  }

  const addMutation = useMutation({
    mutationFn: async (setId: string) => {
      if (!stemId) throw new Error('No stem selected')
      await ucatSetsApi.addStemsToSet(setId, [stemId])
      return setId
    },
    onSuccess: async (setId) => {
      await invalidateMembership(setId)
      toast({ description: 'Stem added to set.' })
    },
    onError: (error) => {
      toast({
        description: error instanceof Error ? error.message : 'Failed to add stem to set.',
        variant: 'destructive',
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (setId: string) => {
      if (!stemId) throw new Error('No stem selected')
      await ucatSetsApi.removeStemsFromSet(setId, [stemId])
      return setId
    },
    onSuccess: async (setId) => {
      await invalidateMembership(setId)
      setRemoveTarget(null)
      toast({ description: 'Stem removed from set.' })
    },
    onError: (error) => {
      toast({
        description: error instanceof Error ? error.message : 'Failed to remove stem from set.',
        variant: 'destructive',
      })
    },
  })

  const handleAddToSet = (set: StaffSetOption) => {
    const rawSet = setsQuery.data?.find((candidate) => candidate.id === set.id)
    const warning = getSetAddStemWarning(rawSet, stemSectionId, sections)
    if (warning) {
      setAddWarning({
        setId: set.id,
        title: warning.title,
        description: warning.description,
      })
      return
    }
    addMutation.mutate(set.id)
  }

  if (!stemId) return null

  const isLoading = setsQuery.isLoading || setDetailQueries.some((query) => query.isLoading)

  return (
    <>
      {highlighted ? (
        <p className="text-xs text-amber-900 dark:text-amber-100">
          Add this private stem to a staff-authored set.
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading set membership...</p>
      ) : currentSets.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not in any staff-authored set.</p>
      ) : (
        <ul className="space-y-1">
          {currentSets.map((set) => (
            <li key={set.id}>
              <div className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-medium"
                  onClick={() => setEditingSetId(set.id)}
                >
                  {set.name}
                </button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 shrink-0 px-2.5"
                  disabled={removeMutation.isPending}
                  onClick={() => setRemoveTarget(set)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SearchableSelect<StaffSetOption>
        items={addableSets}
        value={null}
        onValueChange={(set) => {
          if (set) handleAddToSet(set)
        }}
        getItemId={(set) => set.id}
        getItemLabel={(set) => set.name}
        getItemValue={(set) => `${set.name} ${formatSetQuestionCount(set.questionCount)}`}
        placeholder="Add to set"
        searchPlaceholder="Search sets..."
        emptyMessage="No available sets"
        disabled={setsQuery.isLoading || addMutation.isPending}
        showChevron={false}
        renderItem={(set) => (
          <div className="flex min-w-0 flex-1 flex-col items-start">
            <span className="font-medium">{set.name}</span>
            <SetQuestionCountSubtitle set={set} sections={sections} />
          </div>
        )}
        trigger={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-1"
            disabled={setsQuery.isLoading || addMutation.isPending}
          >
            <Plus className="h-4 w-4" />
            Add to set
          </Button>
        }
        contentWidth="260px"
        align="start"
      />

      <UcatSetEditorDialog
        open={!!editingSetId}
        setId={editingSetId}
        onClose={() => setEditingSetId(null)}
      />

      <AlertDialog open={!!addWarning} onOpenChange={(open) => !open && setAddWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{addWarning?.title ?? 'Review set before adding'}</AlertDialogTitle>
            <AlertDialogDescription>{addWarning?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={addMutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              className={tutorBtnOutline}
              onClick={() => {
                const setId = addWarning?.setId
                setAddWarning(null)
                if (setId) setEditingSetId(setId)
              }}
            >
              View set
            </Button>
            <AlertDialogAction
              disabled={addMutation.isPending}
              onClick={() => {
                const setId = addWarning?.setId
                setAddWarning(null)
                if (setId) addMutation.mutate(setId)
              }}
            >
              {addMutation.isPending ? 'Adding...' : 'Add anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from set?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this stem from &quot;{removeTarget?.name}&quot;? The stem will remain in the question bank.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMutation.isPending}
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}
            >
              {removeMutation.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
