import type { GeneratedStem } from '@/features/ucat/questions/lib/ai-generation/schema'
import { generatedContentToPlainText } from '@/features/ucat/questions/lib/ai-generation/content-blocks'

export type GenerationGateSeverity = 'blocking' | 'warning'

export type GenerationGateIssue = {
  severity: GenerationGateSeverity
  code: string
  message: string
  stemIndex: number
  questionIndex?: number
}

export type GenerationContext = {
  sectionName: string
  categoryName: string | null
  sourcePlainTexts?: string[]
}

const DM_CATEGORIES = new Set([
  'drawing conclusions',
  'logical puzzles',
  'probabilistic and statistical reasoning',
  'recognising assumptions',
  'syllogisms',
  'venn diagrams',
])

function norm(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’']/gu, "'")
    .replace(/\s+/gu, ' ')
}

function optionNorm(value: string): string {
  return norm(value).replace(/[^a-z]/gu, '')
}

function stemText(stem: GeneratedStem): string {
  return generatedContentToPlainText(stem.stemText)
}

function questionText(stem: GeneratedStem, index: number): string {
  return generatedContentToPlainText(stem.questions[index]?.questionText ?? '')
}

function optionText(option: GeneratedStem['questions'][number]['options'][number]): string {
  return generatedContentToPlainText(option.answerText)
}

function explanationText(value: GeneratedStem['questions'][number]['answerExplanation']): string {
  if (!value) return ''
  return generatedContentToPlainText(value)
}

function paragraphCount(text: string): number {
  const blocks = text
    .split(/\n{2,}|\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
  return blocks.length
}

function add(
  issues: GenerationGateIssue[],
  severity: GenerationGateSeverity,
  code: string,
  message: string,
  stemIndex: number,
  questionIndex?: number
) {
  issues.push({ severity, code, message, stemIndex, questionIndex })
}

function validateCommon(stem: GeneratedStem, stemIndex: number, issues: GenerationGateIssue[]) {
  for (let questionIndex = 0; questionIndex < stem.questions.length; questionIndex += 1) {
    const question = stem.questions[questionIndex]
    if (!question) continue

    if (question.questionType === 'multiple_choice') {
      const correctCount = question.options.filter((option) => option.isAnswer).length
      if (correctCount !== 1) {
        add(issues, 'blocking', 'multiple_choice_correct_count', 'Multiple-choice questions must have exactly one correct answer.', stemIndex, questionIndex)
      }
      const explanation = explanationText(question.answerExplanation)
      if (!explanation.trim()) {
        add(issues, 'blocking', 'missing_question_explanation', 'Multiple-choice questions must include a question-level explanation.', stemIndex, questionIndex)
      } else if (explanation.length < 80) {
        add(issues, 'warning', 'thin_question_explanation', 'Question-level explanation may be too thin to explain the correct answer and distractors.', stemIndex, questionIndex)
      }
    }

    if (question.questionType === 'syllogism') {
      if (question.options.length !== 5) {
        add(issues, 'blocking', 'syllogism_option_count', 'Syllogism questions must have exactly five Yes/No statements.', stemIndex, questionIndex)
      }
      question.options.forEach((option, optionIndex) => {
        const explanation = explanationText(option.answerExplanation)
        if (!explanation.trim()) {
          add(issues, 'blocking', 'missing_syllogism_option_explanation', `Syllogism option ${optionIndex + 1} must explain why the answer is Yes or No.`, stemIndex, questionIndex)
        } else if (explanation.length < 30) {
          add(issues, 'warning', 'thin_syllogism_option_explanation', `Syllogism option ${optionIndex + 1} explanation may be too thin.`, stemIndex, questionIndex)
        }
      })
    }
  }
}

function validateVr(stem: GeneratedStem, stemIndex: number, categoryName: string | null, issues: GenerationGateIssue[]) {
  const category = norm(categoryName)
  if (stem.questions.length !== 4) {
    add(issues, 'blocking', 'vr_question_count', 'Verbal Reasoning stems must have exactly 4 questions.', stemIndex)
  }
  const count = paragraphCount(stemText(stem))
  if (count < 2 || count > 6) {
    add(issues, 'blocking', 'vr_paragraph_count', 'Verbal Reasoning stems must contain 2 to 6 paragraphs.', stemIndex)
  }
  if (category !== 'reading comprehension' && category !== "true, false, can't tell") {
    add(issues, 'blocking', 'vr_category', 'Verbal Reasoning stems must use Reading Comprehension or True, False, Can\'t Tell.', stemIndex)
  }

  for (let questionIndex = 0; questionIndex < stem.questions.length; questionIndex += 1) {
    const question = stem.questions[questionIndex]
    if (!question) continue
    if (question.questionType !== 'multiple_choice') {
      add(issues, 'blocking', 'vr_question_type', 'Verbal Reasoning questions must be stored as multiple_choice.', stemIndex, questionIndex)
    }
    if (category === 'reading comprehension' && question.options.length !== 4) {
      add(issues, 'blocking', 'vr_reading_comprehension_options', 'Reading Comprehension questions must have exactly 4 options.', stemIndex, questionIndex)
    }
    if (category === "true, false, can't tell") {
      const normalized = question.options.map((option) => optionNorm(optionText(option))).sort().join('|')
      if (normalized !== ['canttell', 'false', 'true'].sort().join('|')) {
        add(issues, 'blocking', 'vr_tfct_options', "True, False, Can't Tell questions must have exactly True, False, and Can't Tell options.", stemIndex, questionIndex)
      }
    }
  }
}

function validateDm(stem: GeneratedStem, stemIndex: number, categoryName: string | null, issues: GenerationGateIssue[]) {
  const category = norm(categoryName)
  if (!DM_CATEGORIES.has(category)) {
    add(issues, 'blocking', 'dm_category', 'Decision Making candidates must select a valid DM category.', stemIndex)
  }
  if (stem.questions.length !== 1) {
    add(issues, 'blocking', 'dm_question_count', 'Decision Making stems must have exactly 1 question.', stemIndex)
  }
  const qText = norm(questionText(stem, 0))
  if (category === 'syllogisms') {
    const expected = norm("Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.")
    if (qText !== expected) {
      add(issues, 'blocking', 'dm_syllogism_question_text', 'Syllogism question text must match the required UCAT instruction.', stemIndex, 0)
    }
    if (stem.questions[0]?.questionType !== 'syllogism') {
      add(issues, 'blocking', 'dm_syllogism_question_type', 'Syllogism category questions must be stored as syllogism.', stemIndex, 0)
    }
  }
  if (category === 'recognising assumptions') {
    const expected = norm('Select the strongest argument from the statements below.')
    if (qText !== expected) {
      add(issues, 'blocking', 'dm_assumption_question_text', 'Recognising Assumptions question text must match the required UCAT instruction.', stemIndex, 0)
    }
  }
}

function validateQr(stem: GeneratedStem, stemIndex: number, issues: GenerationGateIssue[]) {
  if (stem.questions.length < 1 || stem.questions.length > 4) {
    add(issues, 'blocking', 'qr_question_count', 'Quantitative Reasoning stems must have 1 to 4 questions.', stemIndex)
  }
  stem.questions.forEach((question, questionIndex) => {
    if (question.questionType !== 'multiple_choice') {
      add(issues, 'blocking', 'qr_question_type', 'Quantitative Reasoning questions must be stored as multiple_choice.', stemIndex, questionIndex)
    }
    if (question.options.length !== 5) {
      add(issues, 'blocking', 'qr_option_count', 'Quantitative Reasoning questions must have exactly 5 answer options.', stemIndex, questionIndex)
    }
  })
}

function validateSj(stem: GeneratedStem, stemIndex: number, categoryName: string | null, issues: GenerationGateIssue[]) {
  const category = norm(categoryName)
  if (stem.questions.length !== 4) {
    add(issues, 'blocking', 'sj_question_count', 'Situational Judgement stems must have exactly 4 questions.', stemIndex)
  }
  const expected =
    category === 'how important'
      ? ['Very important', 'Important', 'Of minor importance', 'Not important at all']
      : category === 'how appropriate'
        ? ['A very appropriate thing to do', 'Appropriate, but not ideal', 'Inappropriate, but not awful', 'A very inappropriate thing to do']
        : null
  if (!expected) {
    add(issues, 'blocking', 'sj_category', 'Situational Judgement category must be How Important or How Appropriate.', stemIndex)
  }

  stem.questions.forEach((question, questionIndex) => {
    if (question.questionType !== 'multiple_choice') {
      add(issues, 'blocking', 'sj_question_type', 'Situational Judgement questions must be stored as multiple_choice.', stemIndex, questionIndex)
    }
    if (question.options.length !== 4) {
      add(issues, 'blocking', 'sj_option_count', 'Situational Judgement questions must have exactly 4 options.', stemIndex, questionIndex)
    }
    if (expected) {
      const actual = question.options.map((option) => norm(optionText(option)))
      const expectedNorm = expected.map(norm)
      if (actual.join('|') !== expectedNorm.join('|')) {
        add(issues, 'blocking', 'sj_option_text', 'Situational Judgement answer options must match the selected category exactly and in order.', stemIndex, questionIndex)
      }
    }
  })
}

function validateSimilarity(stem: GeneratedStem, stemIndex: number, sourcePlainTexts: string[], issues: GenerationGateIssue[]) {
  if (sourcePlainTexts.length === 0) return
  const candidate = norm(
    [
      stemText(stem),
      ...stem.questions.flatMap((question) => [
        generatedContentToPlainText(question.questionText),
        ...question.options.map(optionText),
      ]),
    ].join(' ')
  )
  if (candidate.length < 120) return
  for (const source of sourcePlainTexts) {
    const sourceText = norm(source)
    if (sourceText.length < 120) continue
    const candidateTokens = new Set(candidate.split(' ').filter((token) => token.length > 4))
    const sourceTokens = sourceText.split(' ').filter((token) => token.length > 4)
    const overlap = sourceTokens.filter((token) => candidateTokens.has(token)).length
    const ratio = overlap / Math.max(1, Math.min(candidateTokens.size, sourceTokens.length))
    if (ratio >= 0.72) {
      add(issues, 'blocking', 'source_similarity', 'Candidate is too textually similar to a selected source example.', stemIndex)
      return
    }
  }
}

export function validateGeneratedStemCandidate(
  stem: GeneratedStem,
  stemIndex: number,
  context: GenerationContext
): GenerationGateIssue[] {
  const issues: GenerationGateIssue[] = []
  validateCommon(stem, stemIndex, issues)
  const section = norm(context.sectionName)
  const category = stem.categoryName ?? context.categoryName

  if (section === 'verbal reasoning') validateVr(stem, stemIndex, category, issues)
  else if (section === 'decision making') validateDm(stem, stemIndex, category, issues)
  else if (section === 'quantitative reasoning') validateQr(stem, stemIndex, issues)
  else if (section === 'situational judgement') validateSj(stem, stemIndex, category, issues)
  else add(issues, 'warning', 'unknown_section', 'Section-specific generation gates were not applied.', stemIndex)

  validateSimilarity(stem, stemIndex, context.sourcePlainTexts ?? [], issues)
  return issues
}

export function hasBlockingIssues(issues: GenerationGateIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'blocking')
}
