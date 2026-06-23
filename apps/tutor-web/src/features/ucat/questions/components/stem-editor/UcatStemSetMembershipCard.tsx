'use client'

import { useMemo } from 'react'
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Json } from '@altitutor/shared'
import { Button, SearchableSelect, useToast } from '@altitutor/ui'
import { Plus, X } from 'lucide-react'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { cn } from '@/shared/utils'

type StaffSetOption = {
  id: string
  name: string
}

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

  return (
    <div
      className={cn(
        'space-y-3 rounded-md border p-3',
        highlighted ? 'border-amber-400 bg-amber-50/80 shadow-sm dark:border-amber-700 dark:bg-amber-950/30' : 'bg-background',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Sets</div>
          {highlighted ? (
            <p className="mt-1 text-xs text-amber-900 dark:text-amber-100">
              Add this private stem to a staff-authored set.
            </p>
          ) : null}
        </div>
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
            <Button type="button" variant="outline" size="sm" className="gap-1" disabled={setsQuery.isLoading || addMutation.isPending}>
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          }
          contentWidth="260px"
          align="end"
        />
      </div>

      {setsQuery.isLoading || setDetailQueries.some((query) => query.isLoading) ? (
        <p className="text-xs text-muted-foreground">Loading set membership...</p>
      ) : currentSets.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not in any staff-authored set.</p>
      ) : (
        <ul className="space-y-1">
          {currentSets.map((set) => (
            <li key={set.id} className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1.5">
              <span className="min-w-0 truncate text-sm">{set.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(set.id)}
                aria-label={`Remove from ${set.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
