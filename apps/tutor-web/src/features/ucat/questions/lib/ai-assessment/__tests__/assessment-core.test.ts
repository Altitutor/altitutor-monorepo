import type { UcatAssessmentSnapshot } from '../schema'
import { automaticReviewEnvironment } from '@/features/ucat/questions/server/ai-assessment/environment'
import {
  changedAssessmentScope,
  compactUcatAssessmentSnapshot,
  fingerprintUcatAssessmentSnapshot,
} from '@/features/ucat/questions/server/ai-assessment/content'
import { runUcatFormatChecks } from '@/features/ucat/questions/server/ai-assessment/format-checks'
import {
  buildAssessmentUserPrompt,
  buildBlindSolverUserPrompt,
} from '@/features/ucat/questions/server/ai-assessment/prompts'
import { applyUcatAssessmentPatches } from '../apply-patches'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'

const STEM_ID = '00000000-0000-0000-0000-000000000001'
const QUESTION_1 = '00000000-0000-0000-0000-000000000010'
const QUESTION_2 = '00000000-0000-0000-0000-000000000020'

function snapshot(): UcatAssessmentSnapshot {
  const question = (id: string, index: number) => ({
    id,
    index,
    questionText: plainTextToProseMirror(`Question ${index}`),
    questionTextPlain: `Question ${index}`,
    answerExplanation: plainTextToProseMirror('Teaching explanation'),
    answerExplanationPlain: 'Teaching explanation',
    questionType: 'multiple_choice' as const,
    difficulty: 0.5,
    timeBurdenSeconds: 75,
    tagIds: [],
    tagNames: [],
    images: [],
    options: Array.from({ length: 5 }, (_, optionIndex) => ({
      id: `00000000-0000-0000-${String(index).padStart(4, '0')}-${String(optionIndex + 1).padStart(12, '0')}`,
      index: optionIndex,
      answerText: plainTextToProseMirror(`Option ${optionIndex + 1}`),
      answerTextPlain: `Option ${optionIndex + 1}`,
      answerExplanation: null,
      answerExplanationPlain: '',
      isAnswer: optionIndex === 0,
      images: [],
    })),
  })
  return {
    stemId: STEM_ID,
    status: 'in_review',
    sectionId: '00000000-0000-0000-0000-000000000002',
    sectionName: 'Quantitative Reasoning',
    sectionNumber: 3,
    displayColumns: 2,
    categoryId: '00000000-0000-0000-0000-000000000003',
    categoryName: 'Any presentation label',
    accessScope: 'public',
    stemText: plainTextToProseMirror('Shared data'),
    stemTextPlain: 'Shared data',
    images: [],
    questions: [question(QUESTION_1, 1), question(QUESTION_2, 2)],
  }
}

describe('automatic review environment gate', () => {
  const originalEnabled = process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED
  const originalVercelEnv = process.env.VERCEL_ENV

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED
    else process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED = originalEnabled
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = originalVercelEnv
  })

  it('defaults off outside production and allows an explicit local opt-in', () => {
    delete process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED
    process.env.VERCEL_ENV = 'preview'
    expect(automaticReviewEnvironment()).toEqual({ enabled: false, source: 'non_production_default' })

    process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED = 'true'
    expect(automaticReviewEnvironment()).toEqual({ enabled: true, source: 'explicit' })
  })

  it('defaults on only in Vercel production and supports an explicit kill switch', () => {
    delete process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED
    process.env.VERCEL_ENV = 'production'
    expect(automaticReviewEnvironment()).toEqual({ enabled: true, source: 'production_default' })

    process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED = 'false'
    expect(automaticReviewEnvironment()).toEqual({ enabled: false, source: 'explicit' })
  })
})

describe('assessment fingerprints and scope', () => {
  it('ignores rich-text marks but isolates a one-question content change', () => {
    const initial = snapshot()
    const initialFingerprints = fingerprintUcatAssessmentSnapshot(initial)
    const formattingOnly = JSON.parse(JSON.stringify(initial)) as UcatAssessmentSnapshot
    formattingOnly.questions[0].questionText = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Question 1', marks: [{ type: 'bold' }] }] }],
    }
    expect(changedAssessmentScope(initialFingerprints, fingerprintUcatAssessmentSnapshot(formattingOnly))).toBeNull()

    const changed = JSON.parse(JSON.stringify(initial)) as UcatAssessmentSnapshot
    changed.questions[1].options[1].isAnswer = true
    changed.questions[1].options[0].isAnswer = false
    expect(changedAssessmentScope(initialFingerprints, fingerprintUcatAssessmentSnapshot(changed))).toEqual({
      scopeType: 'questions',
      questionIds: [QUESTION_2],
    })
  })

  it('invalidates the full stem when shared content changes', () => {
    const initial = snapshot()
    const changed = JSON.parse(JSON.stringify(initial)) as UcatAssessmentSnapshot
    changed.stemText = plainTextToProseMirror('Different shared data')
    expect(changedAssessmentScope(
      fingerprintUcatAssessmentSnapshot(initial),
      fingerprintUcatAssessmentSnapshot(changed),
    )).toEqual({ scopeType: 'full', questionIds: [] })
  })

  it('removes embedded image sources from the durable audit snapshot', () => {
    const initial = snapshot()
    initial.stemText = {
      type: 'doc',
      content: [{
        type: 'image',
        attrs: {
          src: 'data:image/svg+xml;base64,PHN2Zy8+',
          fileId: '00000000-0000-0000-0000-000000000099',
          visualType: 'vega_lite_chart',
          visualSpec: { width: 400 },
        },
      }],
    }
    initial.images = [{
      location: 'stem:stem_text',
      index: 0,
      src: 'data:image/svg+xml;base64,PHN2Zy8+',
      fileId: '00000000-0000-0000-0000-000000000099',
      storagePath: 'visuals/chart.svg',
      alt: 'Chart',
      visualType: 'vega_lite_chart',
      visualSpec: { width: 400 },
      visualTitle: null,
      visualAltText: 'Chart',
      modelWidth: 400,
      modelHeight: 300,
      authoringMetadata: { modelSpecifiedDimensions: { width: 400, height: 300 } },
    }]
    const compact = compactUcatAssessmentSnapshot(initial)
    expect(JSON.stringify(compact)).not.toContain('PHN2Zy8+')
    expect(compact.images[0].src).toBeNull()
    expect(compact.images[0].authoringMetadata).toEqual({ modelSpecifiedDimensions: { width: 400, height: 300 } })
  })
})

describe('assessment prompts and deterministic checks', () => {
  it('keeps the blind solve free of keys, explanations, difficulty, and timing', () => {
    const value = snapshot()
    const prompt = buildBlindSolverUserPrompt({ snapshot: value, targetQuestionIds: [QUESTION_1] })
    expect(prompt).toContain('optionId')
    expect(prompt).not.toContain('keyedAnswer')
    expect(prompt).not.toContain('Teaching explanation')
    expect(prompt).not.toContain('claimedDifficulty')
    expect(prompt).not.toContain('timeBurdenSeconds')
  })

  it('gives the moderator the blind answer and actual teaching/key metadata', () => {
    const value = snapshot()
    const prompt = buildAssessmentUserPrompt({
      snapshot: value,
      targetQuestionIds: [QUESTION_1],
      includeSharedAssessment: true,
      blindSolution: {
        solutions: [{
          questionId: QUESTION_1,
          selectedOptionId: value.questions[0].options[1].id,
          proposedAnswer: null,
          syllogismAnswers: [],
          justification: 'Independent result',
          confidence: 0.9,
          ambiguous: false,
          unsolvable: false,
        }],
      },
      formatChecks: [],
    })
    expect(prompt).toContain('blindSolution')
    expect(prompt).toContain('keyedAnswer')
    expect(prompt).toContain('Teaching explanation')
    expect(prompt).toContain('qrCategoryFitMustNotBeAssessed')
  })

  it('does not spend a QR format check on category fit', () => {
    const value = snapshot()
    const checks = runUcatFormatChecks(value)
    expect(checks.map((check) => check.code)).not.toContain('qr_category')
  })
})

describe('bounded suggestion patches', () => {
  it('re-keys an existing answer option without saving anything', async () => {
    const value = snapshot()
    const form = {
      sectionId: value.sectionId,
      categoryId: value.categoryId,
      stemText: value.stemText,
      accessScope: 'public' as const,
      questions: value.questions.map((question) => ({
        id: question.id,
        questionText: question.questionText,
        questionType: question.questionType,
        answerExplanation: question.answerExplanation,
        difficulty: question.difficulty,
        timeBurdenSeconds: '1:15',
        tagIds: [],
        options: question.options.map((option) => ({
          id: option.id,
          answerText: option.answerText,
          answerExplanation: option.answerExplanation,
          isAnswer: option.isAnswer,
        })),
      })),
    }
    const target = value.questions[0].options[2].id
    const result = await applyUcatAssessmentPatches(form, [{
      operation: 'set_answer_key',
      questionId: QUESTION_1,
      currentCorrectOptionId: value.questions[0].options[0].id,
      correctOptionId: target,
    }])
    expect(result.questions[0].options.map((option) => option.isAnswer)).toEqual([false, false, true, false, false])
    expect(form.questions[0].options[0].isAnswer).toBe(true)
  })
})
