import {
  BulkImportRepairResponseSchema,
  BulkImportReviewDirectiveSchema,
  parseBulkImportAuditRepairResponse,
  parseUcatAssessmentResponse,
  type UcatAssessmentSnapshot,
} from '../schema'
import { automaticReviewEnvironment, resolveReviewTriggerGate } from '@/features/ucat/questions/server/ai-assessment/environment'
import {
  changedAssessmentScope,
  compactUcatAssessmentSnapshot,
  fingerprintUcatAssessmentSnapshot,
} from '@/features/ucat/questions/server/ai-assessment/content'
import { runUcatFormatChecks } from '@/features/ucat/questions/server/ai-assessment/format-checks'
import {
  ASSESSMENT_SYSTEM_PROMPT,
  BULK_IMPORT_AUDIT_REPAIR_SYSTEM_PROMPT,
  buildAssessmentUserPrompt,
  buildBulkImportAuditRepairUserPrompt,
  buildBlindSolverUserPrompt,
  buildIndependentAuditUserPrompt,
} from '@/features/ucat/questions/server/ai-assessment/prompts'
import { EXPLANATION_TEACHING_RUBRIC } from '@/features/ucat/questions/lib/ai-generation/explanation-rubric'
import {
  applyUcatAssessmentPatches,
  ucatAssessmentPatchesAlreadyApplied,
  ucatAssessmentSetTextIsStale,
} from '../apply-patches'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { parseEmbeddedImageDataUri } from '@/features/ucat/questions/server/ai-assessment/visual-evidence'
import { normalizeBlindSolutionSelections } from '@/features/ucat/questions/server/ai-assessment/normalize-blind-solution'
import { reusableBlindSolutionForScope } from '@/features/ucat/questions/server/ai-assessment/run-background-assessment'
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
    responseType: 'multiple_choice' as const,
    answerScheme: 'single_choice' as const,
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
      answerKeyValue: optionIndex === 0 ? 'correct' as const : null,
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

function vrSnapshot(questionCount: number): UcatAssessmentSnapshot {
  const value = snapshot()
  value.sectionName = 'Verbal Reasoning'
  value.categoryName = 'Reading Comprehension'
  value.stemText = plainTextToProseMirror('First paragraph.\n\nSecond paragraph.')
  value.stemTextPlain = 'First paragraph.\n\nSecond paragraph.'
  const template = value.questions[0]
  if (!template) throw new Error('expected a template question')
  value.questions = Array.from({ length: questionCount }, (_, index) => ({
    ...template,
    id: `00000000-0000-0000-0000-${String(index + 10).padStart(12, '0')}`,
    index: index + 1,
    options: template.options.slice(0, 4).map((option, optionIndex) => ({
      ...option,
      id: `00000000-0000-0000-${String(index + 10).padStart(4, '0')}-${String(optionIndex + 1).padStart(12, '0')}`,
      index: optionIndex,
    })),
  }))
  return value
}

describe('automatic review environment gate', () => {
  const originalEnabled = process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED
  const originalVercelEnv = process.env.VERCEL_ENV
  const originalVercelGitCommitRef = process.env.VERCEL_GIT_COMMIT_REF

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED
    else process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED = originalEnabled
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = originalVercelEnv
    if (originalVercelGitCommitRef === undefined) delete process.env.VERCEL_GIT_COMMIT_REF
    else process.env.VERCEL_GIT_COMMIT_REF = originalVercelGitCommitRef
  })

  it('defaults on for the shared development deployment and allows explicit overrides', () => {
    delete process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_GIT_COMMIT_REF = 'develop'
    expect(automaticReviewEnvironment()).toEqual({ enabled: true, source: 'development_default' })

    process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED = 'false'
    expect(automaticReviewEnvironment()).toEqual({ enabled: false, source: 'explicit' })

    delete process.env.UCAT_AI_AUTOMATIC_REVIEW_ENABLED
    process.env.VERCEL_GIT_COMMIT_REF = 'feature/sandbox'
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

describe('review trigger gate', () => {
  it('allows manual review when automatic review is disabled in settings', () => {
    expect(resolveReviewTriggerGate({
      envEnabled: true,
      automaticReviewEnabled: false,
      triggerKind: 'manual_request',
    })).toBe('allowed')
  })

  it('blocks automatic triggers when automatic review is disabled in settings', () => {
    expect(resolveReviewTriggerGate({
      envEnabled: true,
      automaticReviewEnabled: false,
      triggerKind: 'review_submission',
    })).toBe('disabled')
    expect(resolveReviewTriggerGate({
      envEnabled: true,
      automaticReviewEnabled: false,
      triggerKind: 'content_change',
    })).toBe('disabled')
  })

  it('blocks all triggers when the environment kill switch is off', () => {
    expect(resolveReviewTriggerGate({
      envEnabled: false,
      automaticReviewEnabled: true,
      triggerKind: 'manual_request',
    })).toBe('disabled')
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
    changed.questions[1].options[1].answerKeyValue = 'correct'
    changed.questions[1].options[0].answerKeyValue = null
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
    expect(ASSESSMENT_SYSTEM_PROMPT).toContain('who would answer incorrectly')
    expect(ASSESSMENT_SYSTEM_PROMPT).toContain('0 is easiest and 1 is hardest')
    expect(ASSESSMENT_SYSTEM_PROMPT).toContain('fully correct answer on first exposure')
    expect(ASSESSMENT_SYSTEM_PROMPT).toContain('authored position within the stem')
    expect(ASSESSMENT_SYSTEM_PROMPT).not.toContain('who would answer correctly under exam conditions')
    expect(BULK_IMPORT_AUDIT_REPAIR_SYSTEM_PROMPT).toContain(
      'A difficulty of 0 is valid and means the easiest endpoint',
    )
  })

  it('asks the moderator to repair deterministic failures and write teaching explanations', () => {
    const prompt = JSON.parse(buildAssessmentUserPrompt({
      snapshot: snapshot(),
      targetQuestionIds: [QUESTION_1],
      includeSharedAssessment: true,
      blindSolution: { solutions: [] },
      formatChecks: [{
        severity: 'error',
        code: 'qr_option_count',
        message: 'Quantitative Reasoning questions must have five answer options.',
        scopeType: 'question',
        questionId: QUESTION_1,
        questionIndex: 1,
      }],
    })) as {
      failedDeterministicFormatChecks: Array<{ code: string }>
    }

    expect(prompt.failedDeterministicFormatChecks).toEqual([
      expect.objectContaining({ code: 'qr_option_count' }),
    ])
    expect(ASSESSMENT_SYSTEM_PROMPT).toContain('add plausible, mutually exclusive distractors')
    expect(ASSESSMENT_SYSTEM_PROMPT).toContain(EXPLANATION_TEACHING_RUBRIC)
    expect(ASSESSMENT_SYSTEM_PROMPT).toContain(
      'Decision Making explanations should teach the shortest efficient method',
    )
    expect(ASSESSMENT_SYSTEM_PROMPT).toContain(
      'Verbal Reasoning explanations should identify the specific passage evidence',
    )
    expect(ASSESSMENT_SYSTEM_PROMPT).toContain('correct Yes/No conclusions for binary-placement questions')
    expect(ASSESSMENT_SYSTEM_PROMPT).not.toContain('Yes/No conclusions for syllogisms')
  })

  it('uses atomic typed directives without exposing the blind solve', () => {
    const value = snapshot()
    const auditPayload = JSON.parse(buildIndependentAuditUserPrompt({
      snapshot: value,
      targetQuestionIds: [QUESTION_1, QUESTION_2],
      includeSharedAssessment: true,
      formatChecks: [],
    })) as Record<string, unknown>
    expect(auditPayload).not.toHaveProperty('blindSolution')
    expect(auditPayload.responseShape).toEqual(expect.objectContaining({
      overallSummary: expect.any(String),
      categories: [expect.objectContaining({
        scopeType: expect.any(String),
        category: expect.any(String),
      })],
      findings: [expect.objectContaining({
        suggestion: null,
      })],
    }))

    const repairPayload = JSON.parse(buildBulkImportAuditRepairUserPrompt({
      snapshot: value,
      targetQuestionIds: [QUESTION_1, QUESTION_2],
      includeSharedAssessment: true,
      formatChecks: [],
    })) as Record<string, unknown>
    expect(repairPayload).not.toHaveProperty('blindSolution')
    expect(repairPayload.responseShape).toEqual(expect.objectContaining({
      audit: expect.objectContaining({
        categories: expect.any(Array),
        findings: expect.any(Array),
      }),
      review: expect.objectContaining({
        directives: [expect.objectContaining({
          kind: expect.any(String),
          patch: expect.any(String),
        })],
        manualFindings: expect.any(Array),
      }),
    }))
    expect(repairPayload.allowedPatchShapes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operation: 'set_text',
        target: expect.objectContaining({
          kind: 'stem|question|option',
          field: 'stem_text|question_text|answer_text|answer_explanation',
        }),
        beforeText: 'current exact plain text or null',
        afterText: 'complete replacement text',
      }),
      expect.objectContaining({
        operation: 'set_rich_content',
        before: expect.objectContaining({ type: 'doc' }),
        after: expect.objectContaining({ type: 'doc' }),
      }),
      expect.objectContaining({
        operation: 'set_metadata',
        targetKind: 'stem|question',
        targetId: 'exact UUID',
        before: 'exact current value',
        after: 'replacement value',
      }),
    ]))
    expect(BULK_IMPORT_AUDIT_REPAIR_SYSTEM_PROMPT).toContain('do not see the independent blind solver')
    expect(BULK_IMPORT_AUDIT_REPAIR_SYSTEM_PROMPT).toContain('whole-question insertion')
    expect(BULK_IMPORT_AUDIT_REPAIR_SYSTEM_PROMPT).toContain(EXPLANATION_TEACHING_RUBRIC)
    expect(BULK_IMPORT_AUDIT_REPAIR_SYSTEM_PROMPT).toContain('Explain calculator use where relevant')
    expect(BULK_IMPORT_AUDIT_REPAIR_SYSTEM_PROMPT).toContain(
      'specific passage evidence',
    )
    expect(BULK_IMPORT_AUDIT_REPAIR_SYSTEM_PROMPT).toContain(
      'why alternatives are less appropriate where useful',
    )
    expect(BULK_IMPORT_AUDIT_REPAIR_SYSTEM_PROMPT).toContain(
      'shared Explanation teaching standard and its section-specific guidance',
    )
  })

  it('supplies exact structured table content to the bulk reviewer', () => {
    const value = snapshot()
    value.stemText = {
      type: 'doc',
      content: [{
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [{
            type: 'tableHeader',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Area (m2)' }] }],
          }],
        }],
      }],
    }
    value.stemTextPlain = 'Area (m2)'

    const payload = JSON.parse(buildBulkImportAuditRepairUserPrompt({
      snapshot: value,
      targetQuestionIds: [QUESTION_1],
      includeSharedAssessment: true,
      formatChecks: [],
    })) as { stemText: { structuredDocument?: unknown } }

    expect(payload.stemText.structuredDocument).toEqual(value.stemText)
  })

  it('accepts a structured-content directive as a content repair', () => {
    const document = { type: 'doc', content: [{ type: 'paragraph' }] }
    expect(BulkImportReviewDirectiveSchema.safeParse({
      kind: 'content',
      summary: 'Repair the table header',
      rationale: 'The unit needs a superscript.',
      confidence: 0.98,
      resolvedFindingKeys: ['table-unit'],
      patch: {
        operation: 'set_rich_content',
        target: { kind: 'stem', id: null, field: 'stem_text' },
        before: document,
        after: document,
      },
    }).success).toBe(true)
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
          placementAnswers: [],
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

  it('allows QR stems to contain more than four questions', () => {
    const value = snapshot()
    value.questions = [
      ...value.questions,
      ...Array.from({ length: 3 }, (_, index) => ({
        ...value.questions[0],
        id: `00000000-0000-0000-0000-${String(index + 30).padStart(12, '0')}`,
        index: index + 3,
      })),
    ]

    expect(runUcatFormatChecks(value).map((check) => check.code)).not.toContain(
      'qr_question_count',
    )
  })

  it('blocks Verbal Reasoning stems that contain fewer than four questions', () => {
    const value = vrSnapshot(3)

    expect(runUcatFormatChecks(value)).toContainEqual(expect.objectContaining({
      severity: 'error',
      code: 'vr_question_count',
      scopeType: 'shared',
    }))
  })

  it('allows Verbal Reasoning stems to contain more than four questions', () => {
    const value = vrSnapshot(5)

    expect(runUcatFormatChecks(value).map((check) => check.code)).not.toContain(
      'vr_question_count',
    )
  })

  it('blocks Decision Making stems that contain more than one question', () => {
    const value = snapshot()
    value.sectionName = 'Decision Making'
    value.categoryName = 'Logical Puzzles'

    expect(runUcatFormatChecks(value)).toContainEqual(expect.objectContaining({
      severity: 'error',
      code: 'dm_question_count',
      scopeType: 'shared',
    }))
  })

  it('blocks assessment when formatting source would be visible to students', () => {
    const value = snapshot()
    value.questions[0].answerExplanation = plainTextToProseMirror(
      'Use **option A** after calculating \\(30 \\div 30\\).',
    )
    value.questions[0].answerExplanationPlain =
      'Use **option A** after calculating \\(30 \\div 30\\).'

    expect(runUcatFormatChecks(value)).toContainEqual(expect.objectContaining({
      severity: 'error',
      code: 'literal_rich_text_syntax',
      questionId: QUESTION_1,
    }))
  })
})

describe('bounded suggestion patches', () => {
  it('replaces exact structured rich content without flattening a table', async () => {
    const value = snapshot()
    const before = {
      type: 'doc',
      content: [{
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [{
            type: 'tableHeader',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Drainage area (m2)' }] }],
          }],
        }],
      }],
    }
    const after = {
      type: 'doc',
      content: [{
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [{
            type: 'tableHeader',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Drainage area (km²)' }] }],
          }],
        }],
      }],
    }
    const form = {
      sectionId: value.sectionId,
      categoryId: value.categoryId,
      stemText: before,
      accessScope: 'public' as const,
      questions: value.questions.map((question) => ({
        id: question.id,
        questionText: question.questionText,
        responseType: question.responseType,
        answerScheme: question.answerScheme,
        answerExplanation: question.answerExplanation,
        difficulty: question.difficulty,
        timeBurdenSeconds: '1:15',
        tagIds: [],
        options: question.options,
      })),
    }

    const result = await applyUcatAssessmentPatches(form, [{
      operation: 'set_rich_content',
      target: { kind: 'stem', id: null, field: 'stem_text' },
      before,
      after,
    }])

    expect(result.stemText).toEqual(after)
    expect((result.stemText as { content?: Array<{ type?: string }> }).content?.[0]?.type)
      .toBe('table')
  })

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
        responseType: question.responseType,
        answerScheme: question.answerScheme,
        answerExplanation: question.id === QUESTION_1 ? explanation : question.answerExplanation,
        difficulty: question.difficulty,
        timeBurdenSeconds: '1:15',
        tagIds: [],
        options: question.options.map((option) => ({
          id: option.id,
          answerText: option.answerText,
          answerExplanation: option.answerExplanation,
          answerKeyValue: option.answerKeyValue,
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
        responseType: question.responseType,
        answerScheme: question.answerScheme,
        answerExplanation: question.answerExplanation,
        difficulty: question.difficulty,
        timeBurdenSeconds: '1:15',
        tagIds: [],
        options: question.options.map((option) => ({
          id: option.id,
          answerText: option.answerText,
          answerExplanation: option.answerExplanation,
          answerKeyValue: option.answerKeyValue,
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
    expect(result.questions[0].options.map((option) => option.answerKeyValue)).toEqual([null, null, 'correct', null, null])
    expect(form.questions[0].options[0].answerKeyValue).toBe('correct')
  })

  function formFromSnapshot(value: UcatAssessmentSnapshot, overrides?: {
    difficulty?: number | string | null
    timeBurdenSeconds?: string | number | null
  }): UcatQuestionStemFormValues {
    return {
      sectionId: value.sectionId,
      categoryId: value.categoryId,
      stemText: value.stemText,
      accessScope: 'public',
      questions: value.questions.map((question) => ({
        id: question.id,
        questionText: question.questionText,
        responseType: question.responseType,
        answerScheme: question.answerScheme,
        answerExplanation: question.answerExplanation,
        difficulty: (overrides?.difficulty !== undefined
          ? overrides.difficulty
          : question.difficulty) as number | null,
        timeBurdenSeconds: (overrides?.timeBurdenSeconds !== undefined
          ? overrides.timeBurdenSeconds
          : '1:15') as string,
        tagIds: [],
        options: question.options.map((option) => ({
          id: option.id,
          answerText: option.answerText,
          answerExplanation: option.answerExplanation,
          answerKeyValue: option.answerKeyValue,
        })),
      })),
    }
  }

  it('accepts difficulty patches when the form still holds a DOM string value', async () => {
    const value = snapshot()
    const result = await applyUcatAssessmentPatches(formFromSnapshot(value, { difficulty: '0.5' }), [{
      operation: 'set_metadata',
      targetKind: 'question',
      targetId: QUESTION_1,
      field: 'difficulty',
      before: 0.5,
      after: 0.7,
    }])
    expect(result.questions[0].difficulty).toBe(0.7)
  })

  it('accepts time-burden patches when before is a numeric or mm:ss string', async () => {
    const value = snapshot()
    const fromNumericBefore = await applyUcatAssessmentPatches(formFromSnapshot(value), [{
      operation: 'set_metadata',
      targetKind: 'question',
      targetId: QUESTION_1,
      field: 'time_burden_seconds',
      before: '75',
      after: 90,
    }])
    expect(fromNumericBefore.questions[0].timeBurdenSeconds).toBe('1:30')

    const fromClockBefore = await applyUcatAssessmentPatches(formFromSnapshot(value), [{
      operation: 'set_metadata',
      targetKind: 'question',
      targetId: QUESTION_1,
      field: 'time_burden_seconds',
      before: '1:15',
      after: '105',
    }])
    expect(fromClockBefore.questions[0].timeBurdenSeconds).toBe('1:45')
  })

  it('applies independent difficulty and time-burden suggestions in sequence', async () => {
    const value = snapshot()
    const afterDifficulty = await applyUcatAssessmentPatches(formFromSnapshot(value, { difficulty: '0.5' }), [{
      operation: 'set_metadata',
      targetKind: 'question',
      targetId: QUESTION_1,
      field: 'difficulty',
      before: 0.5,
      after: 0.6,
    }])
    const afterBoth = await applyUcatAssessmentPatches(afterDifficulty, [{
      operation: 'set_metadata',
      targetKind: 'question',
      targetId: QUESTION_1,
      field: 'time_burden_seconds',
      before: 75,
      after: 60,
    }])
    expect(afterBoth.questions[0].difficulty).toBe(0.6)
    expect(afterBoth.questions[0].timeBurdenSeconds).toBe('1:00')
  })

  it('recognises when an explanation suggestion is already present in the form', () => {
    const value = snapshot()
    const form = formFromSnapshot(value)
    form.questions[0].answerExplanation = plainTextToProseMirror('A newly accepted explanation.')

    expect(ucatAssessmentPatchesAlreadyApplied(form, [{
      operation: 'set_text',
      target: { kind: 'question', id: QUESTION_1, field: 'answer_explanation' },
      beforeText: null,
      afterText: 'A newly accepted explanation.',
    }])).toBe(true)
  })

  it('refuses set_text when the model claimed the field was empty but the draft has text', async () => {
    const form = formFromSnapshot(snapshot())
    const patches: Parameters<typeof applyUcatAssessmentPatches>[1] = [{
      operation: 'set_text',
      target: { kind: 'question', id: QUESTION_1, field: 'answer_explanation' },
      beforeText: null,
      afterText: 'One arrow completes the equation.',
    }]

    await expect(applyUcatAssessmentPatches(form, patches)).rejects.toThrow(
      'The suggested text field has changed since this suggestion was created.',
    )
    expect(ucatAssessmentSetTextIsStale(form, patches)).toBe(true)
  })

  it('replaces the whole field when the tutor confirms a stale set_text suggestion', async () => {
    const form = formFromSnapshot(snapshot())
    const result = await applyUcatAssessmentPatches(form, [{
      operation: 'set_text',
      target: { kind: 'question', id: QUESTION_1, field: 'answer_explanation' },
      beforeText: null,
      afterText: 'One arrow completes the equation.',
    }], { overwriteMismatchedSetText: true })

    expect(proseMirrorToPlainText(result.questions[0].answerExplanation).trim())
      .toBe('One arrow completes the equation.')
  })
})

describe('assessment provider input normalization', () => {
  it('accepts cautious repair confidence as review data', () => {
    const parsed = BulkImportRepairResponseSchema.parse({
      overallSummary: 'One cautious repair was proposed.',
      repairs: [{
        summary: 'Set timing',
        rationale: 'The expected timing is approximate.',
        confidence: 0.79,
        resolvedFindingKeys: [],
        patches: [{
          operation: 'set_metadata',
          targetKind: 'question',
          targetId: QUESTION_1,
          field: 'time_burden_seconds',
          before: null,
          after: 60,
        }],
      }],
      unresolvedFindings: [],
    })

    expect(parsed.repairs[0]?.confidence).toBe(0.79)
  })

  it('preserves the audit and valid sibling fixes when one repair is malformed', () => {
    const parsed = parseBulkImportAuditRepairResponse({
      audit: {
        overallSummary: 'The category comments remain useful.',
        categories: [],
        findings: [],
      },
      repair: {
        overallSummary: 'One fix was usable.',
        repairs: [
          {
            summary: 'Set timing',
            rationale: 'Timing can be estimated safely.',
            confidence: 0.8,
            resolvedFindingKeys: [],
            patches: [{
              operation: 'set_metadata',
              targetKind: 'question',
              targetId: QUESTION_1,
              field: 'time_burden_seconds',
              before: null,
              after: 60,
            }],
          },
          {
            summary: 'Broken repair',
            rationale: 'The model returned an invalid patch.',
            confidence: 0.9,
            resolvedFindingKeys: [],
            patches: [{ operation: 'not-a-real-operation' }],
          },
        ],
        unresolvedFindings: [],
      },
    })

    expect(parsed.audit.overallSummary).toBe('The category comments remain useful.')
    expect(parsed.repair.repairs).toHaveLength(1)
    expect(parsed.repair.unresolvedFindings).toEqual([
      expect.objectContaining({ key: 'model-repair-output-incomplete' }),
    ])
  })

  it('normalizes the typed one-patch directive contract for reconciliation', () => {
    const parsed = parseBulkImportAuditRepairResponse({
      audit: {
        overallSummary: 'The explanation is missing.',
        categories: [],
        findings: [],
      },
      review: {
        overallSummary: 'Added the missing teaching explanation.',
        directives: [{
          kind: 'explanation',
          summary: 'Add explanation',
          rationale: 'Students need the solving method.',
          confidence: 0.84,
          resolvedFindingKeys: [],
          patch: {
            operation: 'set_text',
            target: {
              kind: 'question',
              id: QUESTION_1,
              field: 'answer_explanation',
            },
            beforeText: null,
            afterText: 'Identify the relevant evidence, then eliminate each unsupported option.',
          },
        }],
        manualFindings: [],
      },
    })

    expect(parsed.repair.repairs).toEqual([
      expect.objectContaining({
        summary: 'Add explanation',
        confidence: 0.84,
        patches: [expect.objectContaining({ operation: 'set_text' })],
      }),
    ])
  })

  it('keeps the bulk repair response independent of another assessment and solve', () => {
    const parsed = BulkImportRepairResponseSchema.parse({
      repairs: [],
      overallSummary: 'One issue still needs tutor input.',
      unresolvedFindings: [{
        key: 'manual-check',
        scopeType: 'question',
        questionId: QUESTION_1,
        category: 'answer_correctness_fairness',
        rating: 'concern',
        confidence: 0.8,
        title: 'Check ambiguity',
        detail: 'The wording may allow two interpretations.',
        evidence: [],
        recommendedAction: 'review',
        suggestion: 'This irrelevant model prose is ignored.',
      }],
    })

    expect(parsed).not.toHaveProperty('postRepairSolutions')
    expect(parsed).not.toHaveProperty('finalAssessment')
    expect(parsed.unresolvedFindings[0]).not.toHaveProperty('suggestion')
  })

  it('accepts a conventional audit wrapper without weakening assessment validation', () => {
    expect(parseUcatAssessmentResponse({
      audit: {
        overallSummary: 'The keyed content is sound.',
        categories: [],
        findings: [],
      },
    })).toEqual({
      overallSummary: 'The keyed content is sound.',
      categories: [],
      findings: [],
    })
  })

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
        placementAnswers: [],
        justification: 'Option C has the correct calculation.',
        confidence: 0.9,
        ambiguous: false,
        unsolvable: false,
      }],
    }, value)
    expect(normalized.solutions[0].selectedOptionId).toBe(value.questions[0].options[2].id)
  })

  it('reuses a scoped blind solution when repairs retain its selected option', () => {
    const value = snapshot()
    const selectedOptionId = value.questions[0].options[0].id
    const existing = {
      solutions: [{
        questionId: QUESTION_1,
        selectedOptionId,
        proposedAnswer: null,
        placementAnswers: [],
        justification: 'The first option is correct.',
        confidence: 0.99,
        ambiguous: false,
        unsolvable: false,
      }],
    }

    expect(reusableBlindSolutionForScope({
      existing,
      snapshot: value,
      targetQuestionIds: [QUESTION_1],
    })).toEqual(existing)

    value.questions[0].options = value.questions[0].options.slice(1)
    expect(reusableBlindSolutionForScope({
      existing,
      snapshot: value,
      targetQuestionIds: [QUESTION_1],
    })).toBeNull()
  })
})
