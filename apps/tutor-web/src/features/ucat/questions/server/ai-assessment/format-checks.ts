import type {
  UcatAssessmentSnapshot,
  UcatFormatCheck,
} from '@/features/ucat/questions/lib/ai-assessment/schema'

function norm(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’]/gu, "'")
    .replace(/[^a-z0-9']+/gu, ' ')
    .trim()
}

function optionNorm(value: string): string {
  return norm(value).replace(/[^a-z]/gu, '')
}

function paragraphCount(value: string): number {
  return value.split(/\n{2,}|\r?\n/gu).map((part) => part.trim()).filter(Boolean).length
}

function add(
  checks: UcatFormatCheck[],
  severity: 'error' | 'warning',
  code: string,
  message: string,
  question?: UcatAssessmentSnapshot['questions'][number],
) {
  checks.push({
    severity,
    code,
    message,
    scopeType: question ? 'question' : 'shared',
    questionId: question?.id ?? null,
    questionIndex: question?.index ?? null,
  })
}

function commonChecks(snapshot: UcatAssessmentSnapshot, checks: UcatFormatCheck[]) {
  for (const question of snapshot.questions) {
    if (question.questionType === 'multiple_choice') {
      const correctCount = question.options.filter((option) => option.isAnswer).length
      if (correctCount !== 1) {
        add(checks, 'error', 'multiple_choice_correct_count', 'Multiple-choice questions must have exactly one keyed answer.', question)
      }
      if (!question.answerExplanationPlain.trim()) {
        add(checks, 'error', 'missing_question_explanation', 'Multiple-choice questions need one question-level teaching explanation.', question)
      }
      if (question.options.some((option) => option.answerExplanationPlain.trim())) {
        add(checks, 'warning', 'unused_multiple_choice_option_explanations', 'Multiple-choice questions use the question-level explanation; option explanations are not needed.', question)
      }
    } else {
      if (question.options.length !== 5) {
        add(checks, 'error', 'syllogism_option_count', 'Syllogism questions must have exactly five Yes/No statements.', question)
      }
      question.options.forEach((option, optionIndex) => {
        if (!option.answerExplanationPlain.trim()) {
          add(checks, 'error', 'missing_syllogism_option_explanation', `Syllogism option ${optionIndex + 1} needs its own teaching explanation.`, question)
        }
      })
      if (question.answerExplanationPlain.trim()) {
        add(checks, 'warning', 'unused_syllogism_question_explanation', 'Syllogism questions use option-level explanations; a question-level explanation is not needed.', question)
      }
    }
  }
}

function vrChecks(snapshot: UcatAssessmentSnapshot, checks: UcatFormatCheck[]) {
  const category = norm(snapshot.categoryName)
  if (snapshot.questions.length !== 4) {
    add(checks, 'error', 'vr_question_count', 'Verbal Reasoning stems must contain exactly four questions.')
  }
  const paragraphs = paragraphCount(snapshot.stemTextPlain)
  if (paragraphs < 2 || paragraphs > 6) {
    add(checks, 'error', 'vr_paragraph_count', 'Verbal Reasoning passages must contain two to six paragraphs.')
  }
  if (!['reading comprehension', "true false can't tell"].includes(category)) {
    add(checks, 'error', 'vr_category', "Verbal Reasoning must use Reading Comprehension or True, False, Can't Tell.")
  }
  for (const question of snapshot.questions) {
    if (question.questionType !== 'multiple_choice') {
      add(checks, 'error', 'vr_question_type', 'Verbal Reasoning questions must be stored as multiple choice.', question)
    }
    if (category === 'reading comprehension' && question.options.length !== 4) {
      add(checks, 'error', 'vr_reading_comprehension_options', 'Reading Comprehension questions must have four answer options.', question)
    }
    if (category === "true false can't tell") {
      const actual = question.options.map((option) => optionNorm(option.answerTextPlain)).sort().join('|')
      const expected = ['true', 'false', 'canttell'].sort().join('|')
      if (actual !== expected) {
        add(checks, 'error', 'vr_tfct_options', "True, False, Can't Tell questions must have exactly those three answer options.", question)
      }
    }
  }
}

function dmChecks(snapshot: UcatAssessmentSnapshot, checks: UcatFormatCheck[]) {
  const category = norm(snapshot.categoryName)
  const valid = new Set([
    'logical puzzles',
    'probabilistic and statistical reasoning',
    'recognising assumptions',
    'syllogisms',
    'venn diagrams',
  ])
  if (!valid.has(category)) add(checks, 'error', 'dm_category', 'Decision Making must use a recognised category.')
  if (snapshot.questions.length !== 1) add(checks, 'error', 'dm_question_count', 'Decision Making stems must contain exactly one question.')
  const question = snapshot.questions[0]
  if (!question) return
  if (category === 'syllogisms') {
    const expected = norm("Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.")
    if (norm(question.questionTextPlain) !== expected) {
      add(checks, 'error', 'dm_syllogism_instruction', 'The syllogism instruction must match the UCAT Yes/No wording.', question)
    }
    if (question.questionType !== 'syllogism') {
      add(checks, 'error', 'dm_syllogism_question_type', 'Syllogism questions must be stored as syllogism.', question)
    }
  } else if (question.questionType !== 'multiple_choice') {
    add(checks, 'error', 'dm_question_type', 'Non-syllogism Decision Making questions must be stored as multiple choice.', question)
  }
  if (category === 'recognising assumptions') {
    const expected = norm('Select the strongest argument from the statements below.')
    if (norm(question.questionTextPlain) !== expected) {
      add(checks, 'error', 'dm_assumption_instruction', 'Recognising Assumptions must use the required strongest-argument instruction.', question)
    }
  }
  if (category === 'venn diagrams') {
    const images = [
      ...snapshot.images,
      ...snapshot.questions.flatMap((item) => [
        ...item.images,
        ...item.options.flatMap((option) => option.images),
      ]),
    ]
    if (!images.some((image) => image.visualType === 'venn_diagram' || image.visualType === 'set_diagram')) {
      add(checks, 'error', 'dm_venn_visual_required', 'Venn Diagram questions require an editable Venn or set-diagram visual.', question)
    }
  }
}

function qrChecks(snapshot: UcatAssessmentSnapshot, checks: UcatFormatCheck[]) {
  if (snapshot.questions.length < 1 || snapshot.questions.length > 4) {
    add(checks, 'error', 'qr_question_count', 'Quantitative Reasoning stems must contain one to four questions.')
  }
  for (const question of snapshot.questions) {
    if (question.questionType !== 'multiple_choice') {
      add(checks, 'error', 'qr_question_type', 'Quantitative Reasoning questions must be stored as multiple choice.', question)
    }
    if (question.options.length !== 5) {
      add(checks, 'error', 'qr_option_count', 'Quantitative Reasoning questions must have five answer options.', question)
    }
  }
}

function sjChecks(snapshot: UcatAssessmentSnapshot, checks: UcatFormatCheck[]) {
  const category = norm(snapshot.categoryName)
  if (snapshot.questions.length !== 4) {
    add(checks, 'error', 'sj_question_count', 'Situational Judgement stems must contain exactly four questions.')
  }
  const expected = category === 'how important'
    ? ['Very important', 'Important', 'Of minor importance', 'Not important at all']
    : category === 'how appropriate'
      ? ['A very appropriate thing to do', 'Appropriate, but not ideal', 'Inappropriate, but not awful', 'A very inappropriate thing to do']
      : null
  if (!expected) add(checks, 'error', 'sj_category', 'Situational Judgement must use How Important or How Appropriate.')
  for (const question of snapshot.questions) {
    if (question.questionType !== 'multiple_choice') {
      add(checks, 'error', 'sj_question_type', 'Situational Judgement questions must be stored as multiple choice.', question)
    }
    if (question.options.length !== 4) {
      add(checks, 'error', 'sj_option_count', 'Situational Judgement questions must have four answer options.', question)
    }
    if (expected) {
      const actual = question.options.map((option) => norm(option.answerTextPlain))
      if (actual.join('|') !== expected.map(norm).join('|')) {
        add(checks, 'error', 'sj_option_text', 'Situational Judgement answer options must exactly match the selected category and order.', question)
      }
    }
  }
}

export function runUcatFormatChecks(snapshot: UcatAssessmentSnapshot): UcatFormatCheck[] {
  const checks: UcatFormatCheck[] = []
  commonChecks(snapshot, checks)
  const section = norm(snapshot.sectionName)
  if (section === 'verbal reasoning') vrChecks(snapshot, checks)
  else if (section === 'decision making') dmChecks(snapshot, checks)
  else if (section === 'quantitative reasoning') qrChecks(snapshot, checks)
  else if (section === 'situational judgement') sjChecks(snapshot, checks)
  else add(checks, 'warning', 'unknown_section', 'No section-specific UCAT format checks were available.')
  return checks
}

export function hasUcatFormatErrors(checks: UcatFormatCheck[]): boolean {
  return checks.some((check) => check.severity === 'error')
}
