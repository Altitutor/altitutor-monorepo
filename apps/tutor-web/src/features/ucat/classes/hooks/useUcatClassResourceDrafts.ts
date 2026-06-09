import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { arrayMove } from '@dnd-kit/sortable'
import { ucatClassesApi } from '@/features/ucat/classes/api/classes'
import type { UcatSessionWithResources } from '@/features/ucat/classes/api/classes'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

export type DraftResource = {
  type: 'set' | 'mock' | 'stem' | 'lesson'
  resource_id: string
  index: number
  draftId: string
}

type DraftBySession = Record<string, DraftResource[]>

export function buildDraftFromSessions(sessions: UcatSessionWithResources[]): DraftBySession {
  const draft: DraftBySession = {}
  for (const s of sessions) {
    draft[s.session_id] = s.resources.map((r, i) => {
      const resource_id =
        r.type === 'set'
          ? r.set_id
          : r.type === 'mock'
            ? r.mock_id
            : r.type === 'lesson'
              ? r.lesson_id
              : r.stem_id
      return {
        type: r.type,
        resource_id,
        index: i,
        draftId: r.id || `draft-${s.session_id}-${r.type}-${resource_id}-${i}`,
      }
    })
  }
  return draft
}

export function useUcatClassResourceDrafts(classId: string | null) {
  const queryClient = useQueryClient()
  const [draftBySession, setDraftBySession] = useState<DraftBySession>({})
  const [initialDraftSnapshot, setInitialDraftSnapshot] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  const isDirty = useMemo(() => JSON.stringify(draftBySession) !== initialDraftSnapshot, [draftBySession, initialDraftSnapshot])

  const initializeFromSessions = useCallback((sessions: UcatSessionWithResources[]) => {
    const draft = buildDraftFromSessions(sessions)
    setDraftBySession(draft)
    setInitialDraftSnapshot(JSON.stringify(draft))
  }, [])

  const reset = useCallback(() => {
    setDraftBySession({})
    setInitialDraftSnapshot('')
  }, [])

  const removeResource = useCallback((sessionId: string, draftId: string) => {
    setDraftBySession((prev) => {
      const list = (prev[sessionId] ?? []).filter((r) => r.draftId !== draftId).map((r, i) => ({ ...r, index: i }))
      return { ...prev, [sessionId]: list }
    })
  }, [])

  const moveResourceByDraftIds = useCallback((activeDraftId: string, overDraftId: string) => {
    if (activeDraftId === overDraftId) return
    setDraftBySession((prev) => {
      for (const sessionId of Object.keys(prev)) {
        const list = prev[sessionId]
        const fromIdx = list.findIndex((r) => r.draftId === activeDraftId)
        const toIdx = list.findIndex((r) => r.draftId === overDraftId)
        if (fromIdx >= 0 && toIdx >= 0) {
          const reordered = arrayMove(list, fromIdx, toIdx).map((r, i) => ({ ...r, index: i }))
          return { ...prev, [sessionId]: reordered }
        }
      }
      return prev
    })
  }, [])

  const appendResourceToSession = useCallback(
    (sessionId: string, type: 'set' | 'mock' | 'stem' | 'lesson', resourceId: string) => {
      setDraftBySession((prev) => {
        const list = prev[sessionId] ?? []
        const draftId = `draft-${sessionId}-${type}-${resourceId}-${Date.now()}`
        const newResource: DraftResource = { type, resource_id: resourceId, index: list.length, draftId }
        return {
          ...prev,
          [sessionId]: [...list, newResource],
        }
      })
    },
    []
  )

  const saveAssignments = useCallback(async () => {
    if (!classId || !isDirty) return
    setIsSaving(true)
    try {
      const assignments = Object.entries(draftBySession).map(([session_id, resources]) => ({
        session_id,
        resources: resources.map((r, index) => ({
          resource_type: r.type,
          resource_id: r.resource_id,
          index,
        })),
      }))
      await ucatClassesApi.replaceSessionResources(assignments)
      queryClient.invalidateQueries({ queryKey: ucatKeys.classes() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.questions() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.learningModules() })
    } finally {
      setIsSaving(false)
    }
  }, [classId, draftBySession, isDirty, queryClient])

  return {
    draftBySession,
    isDirty,
    isSaving,
    initializeFromSessions,
    reset,
    removeResource,
    moveResourceByDraftIds,
    appendResourceToSession,
    saveAssignments,
  }
}

