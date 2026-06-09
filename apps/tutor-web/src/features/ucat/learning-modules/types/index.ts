import type { Json } from '@altitutor/shared'

export type UcatLearningModuleKind = 'folder' | 'lesson'
export type UcatLearningModuleDisplayMode = 'scroll' | 'stepped'

export type UcatLearningModuleBlockType =
  | 'text'
  | 'video'
  | 'file'
  | 'question_stem'
  | 'question'
  | 'skill_trainer_set'

export type UcatLearningModuleRow = {
  id: string
  kind: UcatLearningModuleKind
  title: string
  description: string | null
  ucat_section_id: string | null
  parent_ucat_learning_module_id: string | null
  index: number
  is_private: boolean
  display_mode: UcatLearningModuleDisplayMode | null
  section_name: string | null
  section_number: number | null
  child_count: number
  block_count: number
  updated_at: string
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
  skill_trainer_set_id: string | null
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
  skill_trainer_set_id?: string | null
}

export type UcatLearningModuleUpsertPayload = {
  moduleId?: string | null
  kind: UcatLearningModuleKind
  title: string
  description?: string | null
  ucatSectionId?: string | null
  parentId?: string | null
  index?: number
  isPrivate?: boolean
  displayMode?: UcatLearningModuleDisplayMode
}
