import type { Json } from '@altitutor/shared'
import type {
  LearningModuleBlockInput,
  LearningModuleOperation,
  MockOperation,
  QuestionInput,
  QuestionSetOperation,
  QuestionStemOperation,
} from '@/features/ucat/mcp/server/schemas'
import {
  aiTextToProseMirror,
  findRichTextSyntaxLeaks,
} from '@/features/ucat/shared/lib/rich-text'

type AccessScope = 'public' | 'private'

export type StemAnswerOptionDraft = {
  id?: string
  answer_text: Json
  answer_explanation: Json | null
  index: number
  is_answer: boolean
}

export type StemQuestionDraft = {
  id?: string
  question_text: Json
  answer_explanation: Json | null
  index: number
  difficulty: number | null
  time_burden_seconds: number | null
  question_type: 'multiple_choice' | 'syllogism'
  source_channel: 'individual' | 'bulk_import' | 'ai_generation'
  ai_generation_metadata: Json | null
  tag_ids: string[]
  answer_options: StemAnswerOptionDraft[]
}

export type QuestionStemDraft = {
  sectionId: string
  categoryId: string | null
  stemText: Json
  accessScope: AccessScope
  tutorSourceNote: string | null
  questions: StemQuestionDraft[]
}

export type QuestionSetDraft = {
  name: Json | null
  description: Json
  timeLimitSeconds: number | null
  accessScope: AccessScope
  stemIds: string[]
}

export type MockDraft = {
  name: string
  instructionsText: Json | null
  accessScope: AccessScope
  setIds: string[]
}

export type LearningModuleBlockDraft = {
  id?: string
  block_type: 'text' | 'video' | 'file' | 'question_stem' | 'question' | 'skill_trainer'
  index: number
  require_completion_before_next: boolean
  content: Record<string, unknown>
  question_stem_id: string | null
  question_id: string | null
  file_id: string | null
  skill_trainer_id: string | null
}

export type LearningModuleDraft = {
  kind: 'folder' | 'lesson'
  title: string
  description: string | null
  sectionId: string | null
  parentId: string | null
  index: number
  accessScope: AccessScope
  iconKey: string
  estimatedMinutes: number | null
  studyPlanPriority: 'essential' | 'recommended' | 'optional' | 'excluded'
  studyPlanCategoryIds: string[]
  studyPlanTagIds: string[]
  blocks: LearningModuleBlockDraft[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${label} is missing`)
  return value
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asAccessScope(value: unknown): AccessScope {
  return value === 'private' ? 'private' : 'public'
}

function asJson(value: unknown, fallback: Json): Json {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || Array.isArray(value)
    || isRecord(value)
  ) {
    return value as Json
  }
  return fallback
}

export function toRichTextJson(value: string | Record<string, unknown> | null): Json | null {
  if (value === null) return null
  let normalized: Json
  if (
    isRecord(value)
    && value.format === 'markdown'
    && typeof value.value === 'string'
  ) {
    normalized = aiTextToProseMirror(value.value)
  } else if (typeof value === 'string') {
    normalized = aiTextToProseMirror(value)
  } else {
    normalized = value as Json
  }

  const leaks = findRichTextSyntaxLeaks(normalized)
  if (leaks.length > 0) {
    const kinds = Array.from(new Set(leaks.map((leak) => leak.kind))).join(', ')
    throw new Error(
      `Rich text contains unparsed formatting syntax (${kinds}). Use supported Markdown/LaTeX delimiters or native rich-text nodes.`,
    )
  }
  return normalized
}

function insertAt<T>(items: T[], item: T, requestedIndex?: number): void {
  const index = requestedIndex == null
    ? items.length
    : Math.max(0, Math.min(requestedIndex, items.length))
  items.splice(index, 0, item)
}

function moveById<T extends { id?: string }>(
  items: T[],
  id: string,
  toIndex: number,
  label: string,
): void {
  const fromIndex = items.findIndex((item) => item.id === id)
  if (fromIndex < 0) throw new Error(`${label} ${id} was not found`)
  const [item] = items.splice(fromIndex, 1)
  insertAt(items, item, toIndex)
}

function removeById<T extends { id?: string }>(items: T[], id: string, label: string): void {
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) throw new Error(`${label} ${id} was not found`)
  items.splice(index, 1)
}

function optionFromInput(option: QuestionInput['options'][number]): StemAnswerOptionDraft {
  return {
    answer_text: toRichTextJson(option.answerText) ?? {},
    answer_explanation: toRichTextJson(option.answerExplanation ?? null),
    index: 0,
    is_answer: option.isAnswer,
  }
}

export function questionFromInput(question: QuestionInput): StemQuestionDraft {
  return {
    question_text: toRichTextJson(question.questionText) ?? {},
    answer_explanation: toRichTextJson(question.answerExplanation ?? null),
    index: 0,
    difficulty: question.difficulty ?? null,
    time_burden_seconds: question.timeBurdenSeconds ?? null,
    question_type: question.questionType,
    source_channel: 'ai_generation',
    ai_generation_metadata: {
      source: 'codex_mcp',
    },
    tag_ids: [...question.tagIds],
    answer_options: question.options.map(optionFromInput),
  }
}

export function reindexQuestions(questions: StemQuestionDraft[]): void {
  questions.forEach((question, questionIndex) => {
    question.index = questionIndex + 1
    question.answer_options.forEach((option, optionIndex) => {
      option.index = optionIndex + 1
    })
  })
}

export function questionStemDraftFromDetail(detail: Record<string, unknown>): QuestionStemDraft {
  const rawQuestions = Array.isArray(detail.questions) ? detail.questions : []
  const questions = rawQuestions.map((rawQuestion): StemQuestionDraft => {
    if (!isRecord(rawQuestion)) throw new Error('Question stem contains an invalid question')
    const rawOptions = Array.isArray(rawQuestion.answer_options)
      ? rawQuestion.answer_options
      : []
    const tags = Array.isArray(rawQuestion.tags) ? rawQuestion.tags : []
    return {
      id: asString(rawQuestion.id, 'Question id'),
      question_text: asJson(rawQuestion.question_text, {}),
      answer_explanation: asJson(rawQuestion.answer_explanation, null),
      index: asNumber(rawQuestion.index, 1),
      difficulty: asNullableNumber(rawQuestion.difficulty),
      time_burden_seconds: asNullableNumber(rawQuestion.time_burden_seconds),
      question_type: rawQuestion.question_type === 'syllogism' ? 'syllogism' : 'multiple_choice',
      source_channel: rawQuestion.source_channel === 'bulk_import'
        ? 'bulk_import'
        : rawQuestion.source_channel === 'ai_generation'
          ? 'ai_generation'
          : 'individual',
      ai_generation_metadata: asJson(rawQuestion.ai_generation_metadata, null),
      tag_ids: tags
        .filter(isRecord)
        .map((tag) => asNullableString(tag.id))
        .filter((id): id is string => id !== null),
      answer_options: rawOptions.map((rawOption): StemAnswerOptionDraft => {
        if (!isRecord(rawOption)) throw new Error('Question contains an invalid answer option')
        return {
          id: asString(rawOption.id, 'Answer option id'),
          answer_text: asJson(rawOption.answer_text, {}),
          answer_explanation: asJson(rawOption.answer_explanation, null),
          index: asNumber(rawOption.index, 1),
          is_answer: rawOption.is_answer === true,
        }
      }),
    }
  })

  const draft: QuestionStemDraft = {
    sectionId: asString(detail.section_id, 'Section id'),
    categoryId: asNullableString(detail.question_stem_category_id),
    stemText: asJson(detail.stem_text, {}),
    accessScope: asAccessScope(detail.access_scope),
    tutorSourceNote: typeof detail.tutor_source_note === 'string'
      ? detail.tutor_source_note
      : null,
    questions,
  }
  reindexQuestions(draft.questions)
  return draft
}

export function applyQuestionStemOperations(
  draft: QuestionStemDraft,
  operations: QuestionStemOperation[],
): QuestionStemDraft {
  const next = cloneSerializable(draft)

  for (const operation of operations) {
    if (operation.type === 'set_metadata') {
      if (operation.sectionId !== undefined) next.sectionId = operation.sectionId
      if (operation.categoryId !== undefined) next.categoryId = operation.categoryId
      if (operation.stemText !== undefined) {
        next.stemText = toRichTextJson(operation.stemText) ?? {}
      }
      if (operation.accessScope !== undefined) next.accessScope = operation.accessScope
      if (operation.tutorSourceNote !== undefined) {
        next.tutorSourceNote = operation.tutorSourceNote
      }
      continue
    }

    if (operation.type === 'add_question') {
      insertAt(next.questions, questionFromInput(operation.question), operation.toIndex)
      continue
    }
    if (operation.type === 'move_question') {
      moveById(next.questions, operation.questionId, operation.toIndex, 'Question')
      continue
    }
    if (operation.type === 'remove_question') {
      removeById(next.questions, operation.questionId, 'Question')
      continue
    }

    const question = next.questions.find((item) => item.id === operation.questionId)
    if (!question) throw new Error(`Question ${operation.questionId} was not found`)

    if (operation.type === 'update_question') {
      const { changes } = operation
      if (changes.questionText !== undefined) {
        question.question_text = toRichTextJson(changes.questionText) ?? {}
      }
      if (changes.questionType !== undefined) question.question_type = changes.questionType
      if (changes.answerExplanation !== undefined) {
        question.answer_explanation = toRichTextJson(changes.answerExplanation)
      }
      if (changes.difficulty !== undefined) question.difficulty = changes.difficulty
      if (changes.timeBurdenSeconds !== undefined) {
        question.time_burden_seconds = changes.timeBurdenSeconds
      }
      if (changes.tagIds !== undefined) question.tag_ids = [...changes.tagIds]
      continue
    }
    if (operation.type === 'add_answer_option') {
      insertAt(
        question.answer_options,
        optionFromInput(operation.option),
        operation.toIndex,
      )
      continue
    }
    if (operation.type === 'move_answer_option') {
      moveById(
        question.answer_options,
        operation.optionId,
        operation.toIndex,
        'Answer option',
      )
      continue
    }
    if (operation.type === 'remove_answer_option') {
      removeById(question.answer_options, operation.optionId, 'Answer option')
      continue
    }

    const option = question.answer_options.find((item) => item.id === operation.optionId)
    if (!option) throw new Error(`Answer option ${operation.optionId} was not found`)
    if (operation.changes.answerText !== undefined) {
      option.answer_text = toRichTextJson(operation.changes.answerText) ?? {}
    }
    if (operation.changes.answerExplanation !== undefined) {
      option.answer_explanation = toRichTextJson(operation.changes.answerExplanation)
    }
    if (operation.changes.isAnswer !== undefined) {
      option.is_answer = operation.changes.isAnswer
    }
  }

  reindexQuestions(next.questions)
  return next
}

export function questionSetDraftFromDetail(detail: Record<string, unknown>): QuestionSetDraft {
  const stems = Array.isArray(detail.stems) ? detail.stems : []
  return {
    name: asJson(detail.name, null),
    description: asJson(detail.description, {}),
    timeLimitSeconds: asNullableNumber(detail.time_limit_seconds),
    accessScope: asAccessScope(detail.access_scope),
    stemIds: stems
      .filter(isRecord)
      .map((stem) => asNullableString(stem.stem_id))
      .filter((id): id is string => id !== null),
  }
}

function moveMembership(items: string[], id: string, toIndex: number, label: string): void {
  const fromIndex = items.indexOf(id)
  if (fromIndex < 0) throw new Error(`${label} ${id} was not found`)
  items.splice(fromIndex, 1)
  insertAt(items, id, toIndex)
}

export function applyQuestionSetOperations(
  draft: QuestionSetDraft,
  operations: QuestionSetOperation[],
): QuestionSetDraft {
  const next = cloneSerializable(draft)
  for (const operation of operations) {
    if (operation.type === 'set_metadata') {
      if (operation.name !== undefined) next.name = toRichTextJson(operation.name)
      if (operation.description !== undefined) {
        next.description = toRichTextJson(operation.description) ?? {}
      }
      if (operation.timeLimitSeconds !== undefined) {
        next.timeLimitSeconds = operation.timeLimitSeconds
      }
      if (operation.accessScope !== undefined) next.accessScope = operation.accessScope
    } else if (operation.type === 'add_stem') {
      if (next.stemIds.includes(operation.stemId)) {
        throw new Error(`Stem ${operation.stemId} is already in this set`)
      }
      insertAt(next.stemIds, operation.stemId, operation.toIndex)
    } else if (operation.type === 'move_stem') {
      moveMembership(next.stemIds, operation.stemId, operation.toIndex, 'Stem')
    } else {
      const index = next.stemIds.indexOf(operation.stemId)
      if (index < 0) throw new Error(`Stem ${operation.stemId} was not found`)
      next.stemIds.splice(index, 1)
    }
  }
  return next
}

export function mockDraftFromDetail(detail: Record<string, unknown>): MockDraft {
  const sets = Array.isArray(detail.sets) ? detail.sets : []
  return {
    name: typeof detail.name === 'string' ? detail.name : 'Untitled Mock',
    instructionsText: asJson(detail.instructions_text, null),
    accessScope: asAccessScope(detail.access_scope),
    setIds: sets
      .filter(isRecord)
      .map((set) => asNullableString(set.id))
      .filter((id): id is string => id !== null),
  }
}

export function applyMockOperations(draft: MockDraft, operations: MockOperation[]): MockDraft {
  const next = cloneSerializable(draft)
  for (const operation of operations) {
    if (operation.type === 'set_metadata') {
      if (operation.name !== undefined) next.name = operation.name
      if (operation.instructionsText !== undefined) {
        next.instructionsText = toRichTextJson(operation.instructionsText)
      }
      if (operation.accessScope !== undefined) next.accessScope = operation.accessScope
    } else if (operation.type === 'add_set') {
      if (next.setIds.includes(operation.setId)) {
        throw new Error(`Set ${operation.setId} is already in this mock`)
      }
      insertAt(next.setIds, operation.setId, operation.toIndex)
    } else if (operation.type === 'move_set') {
      moveMembership(next.setIds, operation.setId, operation.toIndex, 'Set')
    } else {
      const index = next.setIds.indexOf(operation.setId)
      if (index < 0) throw new Error(`Set ${operation.setId} was not found`)
      next.setIds.splice(index, 1)
    }
  }
  return next
}

export function blockFromInput(block: LearningModuleBlockInput): LearningModuleBlockDraft {
  return {
    block_type: block.blockType,
    index: 0,
    require_completion_before_next: block.requireCompletionBeforeNext,
    content: normalizeLearningModuleBlockContent(block.blockType, block.content),
    question_stem_id: block.questionStemId ?? null,
    question_id: block.questionId ?? null,
    file_id: block.fileId ?? null,
    skill_trainer_id: block.skillTrainerId ?? null,
  }
}

function normalizeLearningModuleBlockContent(
  blockType: LearningModuleBlockDraft['block_type'],
  content: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = cloneSerializable(content)
  if (blockType !== 'text') return normalized
  const body = normalized.body
  if (typeof body === 'string' || isRecord(body)) {
    normalized.body = toRichTextJson(body)
  }
  return normalized
}

export function reindexBlocks(blocks: LearningModuleBlockDraft[]): void {
  blocks.forEach((block, index) => {
    block.index = index
  })
}

export function learningModuleDraftFromDetail(
  module: Record<string, unknown>,
  rawBlocks: unknown[],
): LearningModuleDraft {
  const blocks = rawBlocks.map((rawBlock): LearningModuleBlockDraft => {
    if (!isRecord(rawBlock)) throw new Error('Learning module contains an invalid block')
    const blockType = rawBlock.block_type
    if (
      blockType !== 'text'
      && blockType !== 'video'
      && blockType !== 'file'
      && blockType !== 'question_stem'
      && blockType !== 'question'
      && blockType !== 'skill_trainer'
    ) {
      throw new Error('Learning module contains an unsupported block type')
    }
    return {
      id: asString(rawBlock.id, 'Block id'),
      block_type: blockType,
      index: asNumber(rawBlock.index),
      require_completion_before_next: rawBlock.require_completion_before_next !== false,
      content: isRecord(rawBlock.content) ? cloneSerializable(rawBlock.content) : {},
      question_stem_id: asNullableString(rawBlock.question_stem_id),
      question_id: asNullableString(rawBlock.question_id),
      file_id: asNullableString(rawBlock.file_id),
      skill_trainer_id: asNullableString(rawBlock.skill_trainer_id),
    }
  })

  const priority = module.study_plan_priority
  const draft: LearningModuleDraft = {
    kind: module.kind === 'folder' ? 'folder' : 'lesson',
    title: typeof module.title === 'string' ? module.title : '',
    description: typeof module.description === 'string' ? module.description : null,
    sectionId: asNullableString(module.ucat_section_id),
    parentId: asNullableString(module.parent_ucat_learning_module_id),
    index: asNumber(module.index),
    accessScope: asAccessScope(module.access_scope),
    iconKey: typeof module.icon_key === 'string' ? module.icon_key : 'book-open',
    estimatedMinutes: asNullableNumber(module.estimated_minutes),
    studyPlanPriority: priority === 'essential'
      || priority === 'optional'
      || priority === 'excluded'
      ? priority
      : 'recommended',
    studyPlanCategoryIds: Array.isArray(module.study_plan_category_ids)
      ? module.study_plan_category_ids.filter((id): id is string => typeof id === 'string')
      : [],
    studyPlanTagIds: Array.isArray(module.study_plan_tag_ids)
      ? module.study_plan_tag_ids.filter((id): id is string => typeof id === 'string')
      : [],
    blocks,
  }
  reindexBlocks(draft.blocks)
  return draft
}

export function applyLearningModuleOperations(
  draft: LearningModuleDraft,
  operations: LearningModuleOperation[],
): LearningModuleDraft {
  const next = cloneSerializable(draft)
  for (const operation of operations) {
    if (operation.type === 'set_metadata') {
      const { changes } = operation
      if (changes.title !== undefined) next.title = changes.title
      if (changes.description !== undefined) next.description = changes.description
      if (changes.sectionId !== undefined) next.sectionId = changes.sectionId
      if (changes.parentId !== undefined) next.parentId = changes.parentId
      if (changes.index !== undefined) next.index = changes.index
      if (changes.accessScope !== undefined) next.accessScope = changes.accessScope
      if (changes.iconKey !== undefined) next.iconKey = changes.iconKey
      if (changes.estimatedMinutes !== undefined) {
        next.estimatedMinutes = changes.estimatedMinutes
      }
      if (changes.studyPlanPriority !== undefined) {
        next.studyPlanPriority = changes.studyPlanPriority
      }
      if (changes.studyPlanCategoryIds !== undefined) {
        next.studyPlanCategoryIds = [...changes.studyPlanCategoryIds]
      }
      if (changes.studyPlanTagIds !== undefined) {
        next.studyPlanTagIds = [...changes.studyPlanTagIds]
      }
    } else if (operation.type === 'add_block') {
      if (next.kind === 'folder') throw new Error('Folders cannot contain lesson blocks')
      insertAt(next.blocks, blockFromInput(operation.block), operation.toIndex)
    } else if (operation.type === 'move_block') {
      moveById(next.blocks, operation.blockId, operation.toIndex, 'Block')
    } else if (operation.type === 'remove_block') {
      removeById(next.blocks, operation.blockId, 'Block')
    } else {
      const block = next.blocks.find((item) => item.id === operation.blockId)
      if (!block) throw new Error(`Block ${operation.blockId} was not found`)
      const { changes } = operation
      if (changes.blockType !== undefined) block.block_type = changes.blockType
      if (changes.requireCompletionBeforeNext !== undefined) {
        block.require_completion_before_next = changes.requireCompletionBeforeNext
      }
      if (changes.content !== undefined) {
        block.content = normalizeLearningModuleBlockContent(block.block_type, changes.content)
      }
      if (changes.questionStemId !== undefined) {
        block.question_stem_id = changes.questionStemId
      }
      if (changes.questionId !== undefined) block.question_id = changes.questionId
      if (changes.fileId !== undefined) block.file_id = changes.fileId
      if (changes.skillTrainerId !== undefined) {
        block.skill_trainer_id = changes.skillTrainerId
      }
    }
  }
  reindexBlocks(next.blocks)
  return next
}
