import type { Json } from '@altitutor/shared'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  plainTextToProseMirror,
  proseMirrorToPlainText,
} from '@/features/ucat/shared/lib/rich-text'

export type BulkImportGateScope =
  | { type: 'stem' }
  | { type: 'question'; questionIndex: number }
  | { type: 'option'; questionIndex: number; optionIndex: number }

export type BulkImportGateIssue = {
  code: string
  message: string
  severity: 'hard'
  scope: BulkImportGateScope
}

export type BulkImportAutomaticFix = {
  code: string
  message: string
  scope: BulkImportGateScope
}

export type BulkImportDeterministicReviewResult = {
  values: UcatQuestionStemFormValues
  issues: BulkImportGateIssue[]
  fixes: BulkImportAutomaticFix[]
  hasHardFailures: boolean
}

type ReviewInput = {
  values: UcatQuestionStemFormValues
  sectionName: string | null | undefined
  categoryName: string | null | undefined
}

type Question = UcatQuestionStemFormValues['questions'][number]
type Option = Question['options'][number]

const SYLLOGISM_INSTRUCTION =
  "Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow."
const ASSUMPTION_INSTRUCTION = 'Select the strongest argument from the statements below.'
const TFCT_OPTIONS = ['True', 'False', "Can't Tell"] as const
const SJT_IMPORTANT_OPTIONS = [
  'Very important',
  'Important',
  'Of minor importance',
  'Not important at all',
] as const
const SJT_APPROPRIATE_OPTIONS = [
  'A very appropriate thing to do',
  'Appropriate, but not ideal',
  'Inappropriate, but not awful',
  'A very inappropriate thing to do',
] as const

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function norm(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’]/gu, "'")
    .replace(/[^a-z0-9']+/gu, ' ')
    .trim()
}

function optionNorm(value: Json): string {
  return norm(proseMirrorToPlainText(value)).replace(/[^a-z]/gu, '')
}

function stemScope(): BulkImportGateScope {
  return { type: 'stem' }
}

function questionScope(questionIndex: number): BulkImportGateScope {
  return { type: 'question', questionIndex }
}

function optionScope(questionIndex: number, optionIndex: number): BulkImportGateScope {
  return { type: 'option', questionIndex, optionIndex }
}

function addIssue(
  issues: BulkImportGateIssue[],
  code: string,
  message: string,
  scope: BulkImportGateScope,
) {
  issues.push({ code, message, severity: 'hard', scope })
}

function addFix(
  fixes: BulkImportAutomaticFix[],
  code: string,
  message: string,
  scope: BulkImportGateScope,
) {
  fixes.push({ code, message, scope })
}

function replaceQuestionText(
  question: Question,
  text: string,
  questionIndex: number,
  code: string,
  message: string,
  fixes: BulkImportAutomaticFix[],
) {
  if (proseMirrorToPlainText(question.questionText) === text) return
  question.questionText = plainTextToProseMirror(text)
  addFix(fixes, code, message, questionScope(questionIndex))
}

function setQuestionType(
  question: Question,
  questionType: Question['questionType'],
  questionIndex: number,
  fixes: BulkImportAutomaticFix[],
) {
  if (question.questionType === questionType) return
  question.questionType = questionType
  addFix(
    fixes,
    'question_type',
    `Changed the stored question type to ${questionType}.`,
    questionScope(questionIndex),
  )
}

/**
 * Reorders a recognisable canonical option set and normalises its labels while
 * preserving the answer key and explanations attached to each semantic option.
 */
function canonicalizeOptions(
  question: Question,
  expected: readonly string[],
  questionIndex: number,
  code: string,
  fixes: BulkImportAutomaticFix[],
): boolean {
  if (question.options.length !== expected.length) return false

  const remaining = [...question.options]
  const ordered: Option[] = []
  for (const label of expected) {
    const index = remaining.findIndex(
      (option) => optionNorm(option.answerText) === norm(label).replace(/[^a-z]/gu, ''),
    )
    if (index < 0) return false
    const [option] = remaining.splice(index, 1)
    if (!option) return false
    ordered.push({
      ...option,
      answerText: plainTextToProseMirror(label),
    })
  }

  const changed = ordered.some((option, index) => {
    const previous = question.options[index]
    return (
      !previous ||
      optionNorm(previous.answerText) !== norm(expected[index]).replace(/[^a-z]/gu, '') ||
      proseMirrorToPlainText(previous.answerText) !== expected[index]
    )
  })
  if (!changed) return true
  question.options = ordered
  addFix(fixes, code, 'Normalised the answer options to the required labels and order.', questionScope(questionIndex))
  return true
}

function stripVrPassageLabels(value: Json): { value: Json; changed: boolean } {
  const next = clone(value)
  let changed = false
  if (!next || typeof next !== 'object' || Array.isArray(next)) return { value: next, changed }
  const root = next as Record<string, Json | undefined>
  if (!Array.isArray(root.content)) return { value: next, changed }

  const retainedBlocks: Json[] = []
  for (const block of root.content) {
    let labelRemovedFromBlock = false
    if (!block || typeof block !== 'object' || Array.isArray(block)) continue
    const record = block as Record<string, Json | undefined>
    if (record.type !== 'paragraph' || !Array.isArray(record.content)) {
      retainedBlocks.push(block)
      continue
    }
    for (const inline of record.content) {
      if (!inline || typeof inline !== 'object' || Array.isArray(inline)) continue
      const textNode = inline as Record<string, Json | undefined>
      if (textNode.type !== 'text' || typeof textNode.text !== 'string') continue
      const stripped = textNode.text.replace(
        /^\s*(?:(?:stem|paragraph)\s+(?:\d+|one|two|three|four|five|six)\s*(?:[:.)-]\s*|\s+|$))/iu,
        '',
      )
      if (stripped !== textNode.text) {
        textNode.text = stripped
        changed = true
        labelRemovedFromBlock = true
      }
      break
    }
    const hasText = record.content.some((inline) => {
      if (!inline || typeof inline !== 'object' || Array.isArray(inline)) return false
      const text = (inline as Record<string, Json | undefined>).text
      return typeof text !== 'string' || text.trim().length > 0
    })
    if (!labelRemovedFromBlock || hasText) retainedBlocks.push(block)
  }
  root.content = retainedBlocks
  return { value: next, changed }
}

function paragraphCount(value: Json): number {
  const plain = proseMirrorToPlainText(value)
  return plain.split(/\n{2,}|\r?\n/gu).map((part) => part.trim()).filter(Boolean).length
}

function commonChecks(
  values: UcatQuestionStemFormValues,
  issues: BulkImportGateIssue[],
) {
  values.questions.forEach((question, questionIndex) => {
    if (question.questionType === 'multiple_choice') {
      if (question.options.filter((option) => option.isAnswer).length !== 1) {
        addIssue(
          issues,
          'multiple_choice_correct_count',
          'Multiple-choice questions must have exactly one keyed answer.',
          questionScope(questionIndex),
        )
      }
      if (!proseMirrorToPlainText(question.answerExplanation).trim()) {
        addIssue(
          issues,
          'missing_question_explanation',
          'Multiple-choice questions need a question-level teaching explanation.',
          questionScope(questionIndex),
        )
      }
      return
    }

    question.options.forEach((option, optionIndex) => {
      if (!proseMirrorToPlainText(option.answerExplanation).trim()) {
        addIssue(
          issues,
          'missing_syllogism_option_explanation',
          `Syllogism option ${optionIndex + 1} needs its own teaching explanation.`,
          optionScope(questionIndex, optionIndex),
        )
      }
    })
  })
}

function vrChecks(
  values: UcatQuestionStemFormValues,
  category: string,
  issues: BulkImportGateIssue[],
  fixes: BulkImportAutomaticFix[],
) {
  if (values.questions.length !== 4) {
    addIssue(issues, 'vr_question_count', 'Verbal Reasoning stems must contain exactly four questions.', stemScope())
  }
  const stripped = stripVrPassageLabels(values.stemText)
  if (stripped.changed) {
    values.stemText = stripped.value
    addFix(
      fixes,
      'vr_passage_labels',
      'Removed synthetic stem or paragraph labels from the passage.',
      stemScope(),
    )
  }
  const count = paragraphCount(values.stemText)
  if (count < 2 || count > 6) {
    addIssue(issues, 'vr_paragraph_count', 'Verbal Reasoning passages must contain two to six paragraphs.', stemScope())
  }

  const isReadingComprehension = category === 'reading comprehension'
  const isTfct = category === "true false can't tell"
  if (!isReadingComprehension && !isTfct) {
    addIssue(
      issues,
      'vr_category',
      "Verbal Reasoning must use Reading Comprehension or True, False, Can't Tell.",
      stemScope(),
    )
  }

  values.questions.forEach((question, questionIndex) => {
    setQuestionType(question, 'multiple_choice', questionIndex, fixes)
    if (isReadingComprehension && question.options.length !== 4) {
      addIssue(
        issues,
        'vr_reading_comprehension_options',
        'Reading Comprehension questions must have exactly four answer options.',
        questionScope(questionIndex),
      )
    }
    if (isTfct && !canonicalizeOptions(question, TFCT_OPTIONS, questionIndex, 'vr_tfct_options', fixes)) {
      addIssue(
        issues,
        'vr_tfct_options',
        "True, False, Can't Tell questions must have exactly those three answer options.",
        questionScope(questionIndex),
      )
    }
  })
}

function dmChecks(
  values: UcatQuestionStemFormValues,
  category: string,
  issues: BulkImportGateIssue[],
  fixes: BulkImportAutomaticFix[],
) {
  const validCategories = new Set([
    'logical puzzles',
    'probabilistic and statistical reasoning',
    'recognising assumptions',
    'syllogisms',
    'venn diagrams',
  ])
  if (!validCategories.has(category)) {
    addIssue(issues, 'dm_category', 'Decision Making must use a recognised category.', stemScope())
  }
  if (values.questions.length !== 1) {
    addIssue(issues, 'dm_question_count', 'Decision Making stems must contain exactly one question.', stemScope())
  }

  const question = values.questions[0]
  if (!question) return
  if (category === 'syllogisms') {
    setQuestionType(question, 'syllogism', 0, fixes)
    replaceQuestionText(
      question,
      SYLLOGISM_INSTRUCTION,
      0,
      'dm_syllogism_instruction',
      'Replaced the syllogism instruction with the canonical UCAT wording.',
      fixes,
    )
    if (question.options.length !== 5) {
      addIssue(
        issues,
        'syllogism_option_count',
        'Syllogism questions must have exactly five conclusion statements.',
        questionScope(0),
      )
    }
    return
  }

  setQuestionType(question, 'multiple_choice', 0, fixes)
  if (category === 'recognising assumptions') {
    replaceQuestionText(
      question,
      ASSUMPTION_INSTRUCTION,
      0,
      'dm_assumption_instruction',
      'Replaced the Recognising Assumptions instruction with the canonical wording.',
      fixes,
    )
    if (question.options.length !== 4) {
      addIssue(
        issues,
        'dm_assumption_option_count',
        'Recognising Assumptions questions must have exactly four arguments.',
        questionScope(0),
      )
    }
  }
}

function qrChecks(values: UcatQuestionStemFormValues, issues: BulkImportGateIssue[]) {
  values.questions.forEach((question, questionIndex) => {
    if (question.options.length !== 5) {
      addIssue(
        issues,
        'qr_option_count',
        'Quantitative Reasoning questions must have exactly five answer options.',
        questionScope(questionIndex),
      )
    }
  })
}

function optionMode(question: Question): 'important' | 'appropriate' | null {
  const normalized = question.options.map((option) => optionNorm(option.answerText)).sort().join('|')
  if (normalized === SJT_IMPORTANT_OPTIONS.map((label) => norm(label).replace(/[^a-z]/gu, '')).sort().join('|')) {
    return 'important'
  }
  if (normalized === SJT_APPROPRIATE_OPTIONS.map((label) => norm(label).replace(/[^a-z]/gu, '')).sort().join('|')) {
    return 'appropriate'
  }
  return null
}

function sjtChecks(
  values: UcatQuestionStemFormValues,
  category: string,
  issues: BulkImportGateIssue[],
  fixes: BulkImportAutomaticFix[],
) {
  const expected =
    category === 'how important'
      ? SJT_IMPORTANT_OPTIONS
      : category === 'how appropriate'
        ? SJT_APPROPRIATE_OPTIONS
        : null
  if (!expected) {
    addIssue(
      issues,
      'sjt_category',
      'Situational Judgement must use How Important or How Appropriate.',
      stemScope(),
    )
  }

  const modes = new Set(values.questions.map(optionMode).filter((mode) => mode !== null))
  if (modes.size > 1) {
    addIssue(
      issues,
      'sjt_mixed_modes',
      'Situational Judgement questions must use one response mode consistently within a stem.',
      stemScope(),
    )
  }

  values.questions.forEach((question, questionIndex) => {
    setQuestionType(question, 'multiple_choice', questionIndex, fixes)
    if (
      expected &&
      !canonicalizeOptions(question, expected, questionIndex, 'sjt_options', fixes)
    ) {
      addIssue(
        issues,
        'sjt_options',
        'Situational Judgement options must exactly match the selected mode and order.',
        questionScope(questionIndex),
      )
    }
  })
}

/**
 * Applies only deterministic, semantics-preserving repairs. Problems that
 * require inventing or deleting content remain scoped hard failures.
 */
export function runBulkImportDeterministicReview(
  input: ReviewInput,
): BulkImportDeterministicReviewResult {
  const values = clone(input.values)
  const issues: BulkImportGateIssue[] = []
  const fixes: BulkImportAutomaticFix[] = []
  const section = norm(input.sectionName)
  const category = norm(input.categoryName)

  if (section === 'verbal reasoning') vrChecks(values, category, issues, fixes)
  else if (section === 'decision making') dmChecks(values, category, issues, fixes)
  else if (section === 'quantitative reasoning') qrChecks(values, issues)
  else if (section === 'situational judgement') sjtChecks(values, category, issues, fixes)
  else addIssue(issues, 'unknown_section', 'No deterministic UCAT gates are available for this section.', stemScope())

  commonChecks(values, issues)
  return {
    values,
    issues,
    fixes,
    hasHardFailures: issues.length > 0,
  }
}
