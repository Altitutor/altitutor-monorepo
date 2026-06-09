import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import type { DraftBlock } from '@/features/ucat/learning-modules/lib/learning-module-editor-types'
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
        content: {},
      }
    case 'question':
      return {
        ...base,
        question_id: block.question_id?.trim() || undefined,
        content: {},
      }
    case 'skill_trainer_set':
      return {
        ...base,
        skill_trainer_set_id: block.skill_trainer_set_id?.trim() || undefined,
        content: block.content,
      }
    default:
      return { ...base, content: block.content }
  }
}

export function validateBlocksForSave(blocks: DraftBlock[]): string | null {
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
        if (!block.question_stem_id) {
          return `${label}: select a question stem before saving`
        }
        break
      case 'question':
        if (!block.question_id) {
          return `${label}: select a question before saving`
        }
        break
      case 'skill_trainer_set':
        if (!block.skill_trainer_set_id) {
          return `${label}: select a skill trainer set before saving`
        }
        break
      default:
        break
    }
  }

  return null
}
