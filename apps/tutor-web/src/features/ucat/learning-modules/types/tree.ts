import type { UcatLearningModuleKind } from '@/features/ucat/learning-modules/types'
import type { UcatContentStatus } from '@/features/ucat/shared/types'

export type UcatLearningModuleTreeNode = {
  id: string
  title: string
  kind: UcatLearningModuleKind
  status: UcatContentStatus
  child_count: number
  block_count: number
  children: UcatLearningModuleTreeNode[]
}
