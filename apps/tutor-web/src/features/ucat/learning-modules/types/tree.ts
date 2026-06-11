import type { UcatLearningModuleKind } from '@/features/ucat/learning-modules/types'

export type UcatLearningModuleTreeNode = {
  id: string
  title: string
  kind: UcatLearningModuleKind
  is_private: boolean
  child_count: number
  block_count: number
  children: UcatLearningModuleTreeNode[]
}
