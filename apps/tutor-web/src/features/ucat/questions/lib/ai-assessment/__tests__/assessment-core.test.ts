import type { UcatAssessmentSnapshot } from '../schema'
import { automaticReviewEnvironment } from '@/features/ucat/questions/server/ai-assessment/environment'
import {
  changedAssessmentScope,
  compactUcatAssessmentSnapshot,
  fingerprintUcatAssessmentSnapshot,
} from '@/features/ucat/questions/server/ai-assessment/content'
import { runUcatFormatChecks } from '@/features/ucat/questions/server/ai-assessment/format-checks'
import {
  ASSESSMENT_SYSTEM_PROMPT,
  buildAssessmentUserPrompt,
  buildBlindSolverUserPrompt,
} from '@/features/ucat/questions/server/ai-assessment/prompts'
import { applyUcatAssessmentPatches } from '../apply-patches'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { parseEmbeddedImageDataUri } from '@/features/ucat/questions/server/ai-assessment/visual-evidence'
import { normalizeBlindSolutionSelections } from '@/features/ucat/questions/server/ai-assessment/normalize-blind-solution'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'

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
  it('preserves rich-text block boundaries for the reviewer instead of flattening list items', () => {
    const value = snapshot()
    value.stemText = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Five displays are installed from Monday to Friday.' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'C is installed immediately after A.' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'D is installed before B.' }] }] },
          ],
        },
      ],
    }
    value.stemTextPlain = proseMirrorToPlainText(value.stemText)

    const prompt = JSON.parse(buildAssessmentUserPrompt({
      snapshot: value,
      targetQuestionIds: [QUESTION_1],
      includeSharedAssessment: true,
      blindSolution: { solutions: [] },
      formatChecks: [],
    })) as { stemText: { blocks: Array<{ kind: string; text: string }>; formattingNote: string } }

    expect(prompt.stemText.blocks).toEqual([
      { kind: 'paragraph', text: 'Five displays are installed from Monday to Friday.' },
      { kind: 'bullet_list_item', text: 'C is installed immediately after A.' },
      { kind: 'bullet_list_item', text: 'D is installed before B.' },
    ])
    expect(prompt.stemText.formattingNote).toContain('do not report missing spaces')
  })

  it('assesses whether difficulty and timing are appropriate for UCAT, not only metadata accuracy', () => {
    expect(buildAssessmentUserPrompt({
      snapshot: snapshot(),
      targetQuestionIds: [QUESTION_1],
      includeSharedAssessment: true,
      blindSolution: { solutions: [] },
      formatChecks: [],
    })).toContain('difficulty_timing')
    expect(ASSESSMENT_SYSTEM_PROMPT).toContain('too trivial, too difficult, too slow')
  })

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
  it('applies an exact suggestion spanning two rich-text list items without flattening the list', async () => {
    const value = snapshot()
    const explanation = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A is relevant but gives no evidence.' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B is unsupported.' }] }] },
        ],
      }],
    }
    const form = {
      sectionId: value.sectionId,
      categoryId: value.categoryId,
      stemText: value.stemText,
      accessScope: 'public',
      questions: value.questions.map((question) => ({
        id: question.id,
        questionText: question.questionText,
        questionType: question.questionType,
        answerExplanation: question.id === QUESTION_1 ? explanation : question.answerExplanation,
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
    } as UcatQuestionStemFormValues
    const result = await applyUcatAssessmentPatches(form, [{
      operation: 'replace_text',
      target: { kind: 'question', id: QUESTION_1, field: 'answer_explanation' },
      beforeText: 'A is relevant but gives no evidence.B is unsupported.',
      afterText: 'A is relevant but gives no evidence. B is less direct.',
    }])

    expect(proseMirrorToPlainText(result.questions[0].answerExplanation)).toBe(
      'A is relevant but gives no evidence.\nB is less direct.',
    )
    expect((result.questions[0].answerExplanation as { content?: Array<{ type?: string }> }).content?.[0]?.type).toBe('bulletList')
  })

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

describe('assessment provider input normalization', () => {
  it('accepts URL-encoded SVG data URIs with charset parameters', () => {
    const parsed = parseEmbeddedImageDataUri('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E')
    expect(parsed?.mimeType).toBe('image/svg+xml')
    expect(parsed?.bytes.toString()).toContain('<svg')
  })

  it('maps a model-returned option label onto the supplied UUID', () => {
    const value = snapshot()
    const normalized = normalizeBlindSolutionSelections({
      solutions: [{
        questionId: QUESTION_1,
        selectedOptionId: 'Option C',
        proposedAnswer: null,
        syllogismAnswers: [],
        justification: 'Option C has the correct calculation.',
        confidence: 0.9,
        ambiguous: false,
        unsolvable: false,
      }],
    }, value)
    expect(normalized.solutions[0].selectedOptionId).toBe(value.questions[0].options[2].id)
  })
})
