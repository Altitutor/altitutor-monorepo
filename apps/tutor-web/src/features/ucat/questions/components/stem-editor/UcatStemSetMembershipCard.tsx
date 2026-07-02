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
import { Eye, Plus } from 'lucide-react'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { cn } from '@/shared/utils'
import { tutorBtnOutline, tutorTransition } from '@/shared/lib/tutor-visual'

type StaffSetOption = {
  id: string
  name: string
}

const setCardClassName = cn(
  'flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.08]',
  tutorTransition,
)

export function UcatStemSetMembershipCard({
  stemId,
  highlighted = false,
}: {
  stemId: string | null | undefined
  highlighted?: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const setsQuery = useUcatSets()
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<StaffSetOption | null>(null)

  const staffSets = useMemo(
    () =>
      (setsQuery.data ?? [])
        .filter((set) => set.id && !set.deleted_at && !set.is_student_generated)
        .map((set) => ({
          id: set.id as string,
          name: proseMirrorToPlainText(set.name as Json | undefined) || 'Untitled',
        })),
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
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('default') }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions('generated') }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.reconciliation() }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.stemCatalog() }),
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

  if (!stemId) return null

  const isLoading = setsQuery.isLoading || setDetailQueries.some((query) => query.isLoading)

  return (
    <>
      <div className="space-y-2">
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
          <ul className="space-y-2">
            {currentSets.map((set) => (
              <li key={set.id} className={setCardClassName}>
                <span className="min-w-0 truncate text-sm font-medium">{set.name}</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(tutorBtnOutline, 'h-8 gap-1 px-2.5')}
                    onClick={() => setEditingSetId(set.id)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      tutorBtnOutline,
                      'h-8 px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive',
                    )}
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
            if (set) addMutation.mutate(set.id)
          }}
          getItemId={(set) => set.id}
          getItemLabel={(set) => set.name}
          getItemValue={(set) => set.name}
          placeholder="Add to set"
          searchPlaceholder="Search sets..."
          emptyMessage="No available sets"
          disabled={setsQuery.isLoading || addMutation.isPending}
          trigger={
            <button
              type="button"
              disabled={setsQuery.isLoading || addMutation.isPending}
              className={cn(
                setCardClassName,
                'w-full justify-center text-sm text-muted-foreground hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50',
              )}
            >
              <Plus className="h-4 w-4" />
              Add to set
            </button>
          }
          contentWidth="260px"
          align="start"
        />
      </div>

      <UcatSetEditorDialog
        open={!!editingSetId}
        setId={editingSetId}
        onClose={() => setEditingSetId(null)}
      />

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
