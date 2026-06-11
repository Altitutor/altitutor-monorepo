import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatLearningModulesApi } from '@/features/ucat/learning-modules/api/modules'
import type {
  UcatLearningModuleBlockPayload,
  UcatLearningModuleUpsertPayload,
} from '@/features/ucat/learning-modules/types'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

export function useUcatLearningModules(options?: { kind?: 'folder' | 'lesson'; enabled?: boolean }) {
  return useQuery({
    queryKey: ucatKeys.learningModules(options?.kind),
    queryFn: () => ucatLearningModulesApi.list(options),
    enabled: options?.enabled !== false,
  })
}

export function useUcatLearningModule(moduleId: string | null) {
  return useQuery({
    queryKey: moduleId ? ucatKeys.learningModule(moduleId) : [...ucatKeys.learningModules(), 'empty'],
    queryFn: () => ucatLearningModulesApi.get(moduleId as string),
    enabled: !!moduleId,
  })
}

export function useUcatLearningModuleBlocks(moduleId: string | null) {
  return useQuery({
    queryKey: moduleId ? ucatKeys.learningModuleBlocks(moduleId) : [...ucatKeys.learningModules(), 'blocks-empty'],
    queryFn: () => ucatLearningModulesApi.listBlocks(moduleId as string),
    enabled: !!moduleId,
  })
}

export function useUpsertUcatLearningModule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UcatLearningModuleUpsertPayload) => ucatLearningModulesApi.upsert(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.learningModules() })
      if (variables.moduleId) {
        queryClient.invalidateQueries({ queryKey: ucatKeys.learningModule(variables.moduleId) })
      }
    },
  })
}

export function useReplaceUcatLearningModuleBlocks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ moduleId, blocks }: { moduleId: string; blocks: UcatLearningModuleBlockPayload[] }) =>
      ucatLearningModulesApi.replaceBlocks(moduleId, blocks),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ucatKeys.learningModuleBlocks(variables.moduleId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.learningModule(variables.moduleId) })
      queryClient.invalidateQueries({ queryKey: ucatKeys.learningModules() })
    },
  })
}

export function useDeleteUcatLearningModule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (moduleId: string) => ucatLearningModulesApi.remove(moduleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ucatKeys.learningModules() }),
  })
}
