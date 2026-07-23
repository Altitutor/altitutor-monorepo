import type { Json } from '@altitutor/shared'
import type { LearningModuleIconKey } from '@/features/ucat/learning-modules/lib/learning-module-icons'
import type { UcatAccessScope, UcatContentStatus } from '@/features/ucat/shared/types'

export type UcatLearningModuleKind = 'folder' | 'lesson'
export type UcatLearningModuleStudyPlanPriority = 'essential' | 'recommended' | 'optional' | 'excluded'

export type UcatLearningModuleBlockType =
  | 'text'
  | 'video'
  | 'file'
  | 'question_stem'
  | 'question'
  | 'skill_trainer'

export type UcatLearningModuleRow = {
  id: string
  kind: UcatLearningModuleKind
  title: string
  description: string | null
  icon_key: LearningModuleIconKey
  estimated_minutes: number | null
  ucat_section_id: string | null
  parent_ucat_learning_module_id: string | null
  index: number
  status: UcatContentStatus
  access_scope: UcatAccessScope
  section_name: string | null
  section_number: number | null
  child_count: number
  block_count: number
  updated_at: string
  deleted_at: string | null
  study_plan_priority: UcatLearningModuleStudyPlanPriority
  study_plan_category_ids: string[]
  study_plan_tag_ids: string[]
}

export type UcatLearningModuleBlockRow = {
  id: string
  learning_module_id: string
  block_type: UcatLearningModuleBlockType
  index: number
  require_completion_before_next: boolean
  content: Json
  question_stem_id: string | null
  question_id: string | null
  file_id: string | null
  skill_trainer_id: string | null
}

/** Payload sent to tutor_ucat_replace_learning_module_blocks */
export type UcatLearningModuleBlockPayload = {
  block_type: UcatLearningModuleBlockType
  index: number
  require_completion_before_next: boolean
  content: Record<string, unknown>
  question_stem_id?: string | null
  question_id?: string | null
  file_id?: string | null
  skill_trainer_id?: string | null
}

export type UcatLearningModuleUpsertPayload = {
  moduleId?: string | null
  kind: UcatLearningModuleKind
  title: string
  description?: string | null
  iconKey?: LearningModuleIconKey
  estimatedMinutes?: number | null
  ucatSectionId?: string | null
  parentId?: string | null
  index?: number
  accessScope?: UcatAccessScope
  studyPlanPriority?: UcatLearningModuleStudyPlanPriority
  studyPlanCategoryIds?: string[]
  studyPlanTagIds?: string[]
}
