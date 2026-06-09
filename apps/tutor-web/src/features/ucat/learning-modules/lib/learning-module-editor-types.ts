import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import type { UcatLearningModuleBlockType } from '@/features/ucat/learning-modules/types'

export type DraftBlock = {
  clientId: string
  block_type: UcatLearningModuleBlockType
  require_completion_before_next: boolean
  content: Record<string, unknown>
  question_stem_id: string | null
  question_id: string | null
  file_id: string | null
  skill_trainer_set_id: string | null
}

export const BLOCK_TYPE_LABELS: Record<UcatLearningModuleBlockType, string> = {
  text: 'Text',
  video: 'Video',
  file: 'File',
  question_stem: 'Question stem',
  question: 'Question',
  skill_trainer_set: 'Skill trainer set',
}

export function newDraftBlock(type: UcatLearningModuleBlockType = 'text'): DraftBlock {
  return {
    clientId: `block-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    block_type: type,
    require_completion_before_next: true,
    content:
      type === 'text'
        ? { body: plainTextToProseMirror('') }
        : type === 'video'
          ? { url: '' }
          : {},
    question_stem_id: null,
    question_id: null,
    file_id: null,
    skill_trainer_set_id: null,
  }
}

export function snapshotSettings(input: {
  kind: string
  title: string
  description: string
  sectionId: string | null
  parentId: string | null
  index: number
  isPrivate: boolean
  displayMode: string
}): string {
  return JSON.stringify(input)
}
