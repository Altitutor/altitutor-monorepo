'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import {
  listContentChanges,
  reviewContentChanges,
  type ContentChangeStatus,
} from '../api/content-changes'

export function useContentChanges(status: ContentChangeStatus) {
  return useQuery({
    queryKey: ucatKeys.contentChanges(status),
    queryFn: () => listContentChanges(status),
  })
}

export function useReviewContentChanges() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reviewContentChanges,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...ucatKeys.all, 'content-changes'] })
    },
  })
}
