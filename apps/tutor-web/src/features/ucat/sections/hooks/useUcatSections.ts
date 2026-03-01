import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatSectionsApi, type UcatSectionPayload } from '@/features/ucat/sections/api/sections'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

export function useUcatSections() {
  return useQuery({ queryKey: ucatKeys.sections(), queryFn: ucatSectionsApi.list })
}

export function useCreateUcatSection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UcatSectionPayload) => ucatSectionsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.sections() }),
  })
}

export function useUpdateUcatSection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UcatSectionPayload }) => ucatSectionsApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.sections() }),
  })
}
