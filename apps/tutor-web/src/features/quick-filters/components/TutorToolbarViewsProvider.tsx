'use client'

import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ToolbarViewsProvider, type ToolbarViewsService } from '@altitutor/ui'
import { useAuthStore } from '@/shared/lib/supabase/auth'
import { tutorViewsApi } from '../api/tutor-views'

export function TutorToolbarViewsProvider({ children }: { children: React.ReactNode }) {
  const userId = useAuthStore((state) => state.user?.id ?? null)
  const queryClient = useQueryClient()
  const save = useCallback<ToolbarViewsService['save']>(async (view) => {
    const result = await tutorViewsApi.save(view)
    await queryClient.invalidateQueries({ queryKey: ['tutor-quick-filters'] })
    return result
  }, [queryClient])
  const remove = useCallback(async (id: string) => {
    await tutorViewsApi.remove(id)
    await queryClient.invalidateQueries({ queryKey: ['tutor-quick-filters'] })
  }, [queryClient])
  const service = useMemo(
    () => (userId ? { userId, shareLabel: 'Share with all tutors', save, remove } : null),
    [remove, save, userId],
  )
  return <ToolbarViewsProvider value={service}>{children}</ToolbarViewsProvider>
}
