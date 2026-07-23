import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import type { DraftBlock } from '@/features/ucat/learning-modules/lib/learning-module-editor-types'
import {
  isPendingGeneratedAssessment,
  isRunBackedPlaceholderWithoutIds,
} from '@/features/ucat/learning-modules/lib/pending-generated-assessment'
import type { UcatLearningModuleBlockPayload } from '@/features/ucat/learning-modules/types'

export function toBlockPayload(blocks: DraftBlock[]): UcatLearningModuleBlockPayload[] {
  return blocks.map((block, index) => sanitizeBlockPayload(block, index))
}

function sanitizeBlockPayload(block: DraftBlock, index: number): UcatLearningModuleBlockPayload {
  const base = {
    block_type: block.block_type,
    index,
    require_completion_before_next: block.require_completion_before_next,
  }

  switch (block.block_type) {
    case 'text':
      return {
        ...base,
        content: {
          ...block.content,
          body: block.content.body ?? plainTextToProseMirror(''),
        },
      }
    case 'video':
      return {
        ...base,
        content: { url: String(block.content.url ?? '') },
      }
    case 'file':
      return {
        ...base,
        file_id: block.file_id?.trim() || undefined,
        content: {
          label: String(block.content.label ?? ''),
          ...(block.content.url ? { url: String(block.content.url) } : {}),
        },
      }
    case 'question_stem':
      return {
        ...base,
        question_stem_id: block.question_stem_id?.trim() || undefined,
        content: block.content,
      }
    case 'question':
      return {
        ...base,
        question_id: block.question_id?.trim() || undefined,
        question_stem_id: block.question_stem_id?.trim() || undefined,
        content: isPendingGeneratedAssessment(block.content) ? block.content : {},
      }
    case 'skill_trainer':
      return {
        ...base,
        skill_trainer_id: block.skill_trainer_id?.trim() || undefined,
        content: block.content,
      }
    default:
      return { ...base, content: block.content }
  }
}

export function validateBlocksForSave(blocks: DraftBlock[], options?: { isPublished?: boolean }): string | null {
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    const label = `Block ${i + 1} (${block.block_type.replace(/_/g, ' ')})`

    switch (block.block_type) {
      case 'video':
        if (!String(block.content.url ?? '').trim()) {
          return `${label}: video URL is required`
        }
        break
      case 'file':
        if (!block.file_id) {
          return `${label}: upload a file before saving`
        }
        break
      case 'question_stem':
      case 'question': {
        const isPending =
          isPendingGeneratedAssessment(block.content) || block.content.pendingGeneratedStem === true
        if (isPending && options?.isPublished) {
          return `${label}: pending generated assessment placeholders can only be saved on unpublished lessons`
        }
        if (isPendingGeneratedAssessment(block.content) && isRunBackedPlaceholderWithoutIds(block)) {
          break
        }
        if (block.block_type === 'question_stem' && !block.question_stem_id) {
          return `${label}: select a question stem before saving`
        }
        if (block.block_type === 'question' && !block.question_id) {
          return `${label}: select a question before saving`
        }
        break
      }
      case 'skill_trainer':
        if (!block.skill_trainer_id) {
          return `${label}: select a skill trainer before saving`
        }
        break
      default:
        break
    }
  }

  return null
}
