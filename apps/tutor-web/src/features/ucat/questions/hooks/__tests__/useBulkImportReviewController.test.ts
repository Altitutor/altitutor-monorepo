import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import {
  automaticFindingStillSafe,
  deriveIncludedBulkImportStems,
  mergeBulkImportReviewResult,
  reviewInputStillCurrent,
  useBulkImportReviewController,
} from '@/features/ucat/questions/hooks/useBulkImportReviewController'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { UcatAssessmentFinding } from '@/features/ucat/questions/lib/ai-assessment/schema'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import {
  bulkImportReviewErrorMessage,
  partitionBulkImportAiFindings,
} from '@/features/ucat/questions/lib/bulk-import-ai-review'

function values(questionIds: string[]): UcatQuestionStemFormValues {
  return {
    sectionId: '10000000-0000-4000-8000-000000000001',
    categoryId: null,
    stemText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Stem' }] }] },
    accessScope: 'public',
    questions: questionIds.map((id) => ({
      id,
      questionText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: id }] }] },
      questionType: 'multiple_choice' as const,
      answerExplanation: null,
      difficulty: null,
      timeBurdenSeconds: null,
      tagIds: [],
      options: [{
        id: id.replace(/.$/u, '9'),
        answerText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
        answerExplanation: null,
        isAnswer: true,
      }],
    })),
  }
}

const STEM_ONE = '20000000-0000-4000-8000-000000000001'
const STEM_TWO = '20000000-0000-4000-8000-000000000002'
const QUESTION_ONE = '30000000-0000-4000-8000-000000000001'
const QUESTION_TWO = '30000000-0000-4000-8000-000000000002'
const QUESTION_THREE = '30000000-0000-4000-8000-000000000003'

const stems: BulkImportStemDraft[] = [
  { id: STEM_ONE, values: values([QUESTION_ONE, QUESTION_TWO]) },
  { id: STEM_TWO, values: values([QUESTION_THREE]) },
]

describe('deriveIncludedBulkImportStems', () => {
  it('removes excluded stems without mutating the draft list', () => {
    const included = deriveIncludedBulkImportStems({
      stems,
      excludedStemIds: new Set([STEM_ONE]),
      excludedQuestionIds: new Set(),
    })

    expect(included.map((stem) => stem.id)).toEqual([STEM_TWO])
    expect(stems).toHaveLength(2)
  })

  it('removes excluded questions and omits stems left with no questions', () => {
    const included = deriveIncludedBulkImportStems({
      stems,
      excludedStemIds: new Set(),
      excludedQuestionIds: new Set([
        `${STEM_ONE}:${QUESTION_TWO}`,
        `${STEM_TWO}:${QUESTION_THREE}`,
      ]),
    })

    expect(included).toHaveLength(1)
    expect(included[0]?.id).toBe(STEM_ONE)
    expect(included[0]?.values.questions.map((question) => question.id)).toEqual([QUESTION_ONE])
    expect(stems[0]?.values.questions).toHaveLength(2)
  })
})

describe('reviewInputStillCurrent', () => {
  it('rejects an AI result when an included question changed while review was running', () => {
    const submitted = values([QUESTION_ONE])
    const current = values([QUESTION_ONE])
    current.questions[0].questionText = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tutor edit' }] }],
    }

    expect(reviewInputStillCurrent({
      submitted,
      current,
      reviewedQuestionIds: new Set([QUESTION_ONE]),
    })).toBe(false)
  })

  it('ignores concurrent edits to questions excluded from this review', () => {
    const submitted = values([QUESTION_ONE])
    const current = values([QUESTION_ONE, QUESTION_TWO])
    current.questions[1].questionText = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Excluded edit' }] }],
    }

    expect(reviewInputStillCurrent({
      submitted,
      current,
      reviewedQuestionIds: new Set([QUESTION_ONE]),
    })).toBe(true)
  })
})

describe('mergeBulkImportReviewResult', () => {
  it('preserves a concurrent non-overlapping edit while applying the AI change', () => {
    const submitted = values([QUESTION_ONE])
    const current = values([QUESTION_ONE])
    const reviewed = values([QUESTION_ONE])
    current.questions[0].difficulty = 0.3
    reviewed.questions[0].answerExplanation = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'AI explanation' }] }],
    }

    const result = mergeBulkImportReviewResult({ submitted, current, reviewed })

    expect(result.conflict).toBe(false)
    expect(result.values.questions[0].difficulty).toBe(0.3)
    expect(result.values.questions[0].answerExplanation).toEqual(
      reviewed.questions[0].answerExplanation,
    )
  })

  it('reports a conflict when the tutor and AI changed the same field differently', () => {
    const submitted = values([QUESTION_ONE])
    const current = values([QUESTION_ONE])
    const reviewed = values([QUESTION_ONE])
    current.questions[0].questionText = plainTextToProseMirror('Tutor wording')
    reviewed.questions[0].questionText = plainTextToProseMirror('AI wording')

    expect(mergeBulkImportReviewResult({ submitted, current, reviewed }).conflict).toBe(true)
  })
})

describe('automaticFindingStillSafe', () => {
  function finding(
    patch: NonNullable<UcatAssessmentFinding['suggestion']>['patches'][number],
  ): UcatAssessmentFinding {
    return {
      key: 'safe-fix',
      scopeType: 'question',
      questionId: QUESTION_ONE,
      category: 'explanation_quality',
      rating: 'concern',
      confidence: 0.99,
      title: 'Safe fix',
      detail: 'A field can be filled.',
      evidence: [],
      recommendedAction: 'fix',
      suggestion: {
        id: 'safe-fix',
        summary: 'Fill the missing field',
        rationale: 'The field is empty.',
        application: 'auto_apply',
        patches: [patch],
      },
    }
  }

  it('auto-fills an empty explanation but does not overwrite an existing explanation', () => {
    const draft = values([QUESTION_ONE])
    const patch = {
      operation: 'set_text' as const,
      target: {
        kind: 'question' as const,
        id: QUESTION_ONE,
        field: 'answer_explanation' as const,
      },
      beforeText: null,
      afterText: 'A teaching explanation.',
    }

    expect(automaticFindingStillSafe(draft, finding(patch))).toBe(true)
    draft.questions[0].answerExplanation = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Existing' }] }],
    }
    expect(automaticFindingStillSafe(draft, finding(patch))).toBe(false)
  })

  it('allows AI tag assignment only when deterministic tagging left the question untagged', () => {
    const draft = values([QUESTION_ONE])
    const patch = {
      operation: 'set_metadata' as const,
      targetKind: 'question' as const,
      targetId: QUESTION_ONE,
      field: 'tag_ids' as const,
      before: [],
      after: ['40000000-0000-4000-8000-000000000001'],
    }

    expect(automaticFindingStillSafe(draft, finding(patch))).toBe(true)
    draft.questions[0].tagIds = ['40000000-0000-4000-8000-000000000002']
    expect(automaticFindingStillSafe(draft, finding(patch))).toBe(false)
  })

  it('requires an unambiguous high-confidence blind-solver match before auto-rekeying', () => {
    const draft = values([QUESTION_ONE])
    const optionId = draft.questions[0].options[0].id as string
    const patch = {
      operation: 'set_answer_key' as const,
      questionId: QUESTION_ONE,
      currentCorrectOptionId: null,
      correctOptionId: optionId,
    }
    const blindSolution = {
      solutions: [{
        questionId: QUESTION_ONE,
        selectedOptionId: optionId,
        syllogismAnswers: [],
        justification: 'The option follows.',
        confidence: 0.99,
        ambiguous: false,
        unsolvable: false,
      }],
    }

    expect(automaticFindingStillSafe(draft, finding(patch), blindSolution)).toBe(true)
    expect(automaticFindingStillSafe(draft, finding(patch), {
      solutions: [{ ...blindSolution.solutions[0], ambiguous: true }],
    })).toBe(false)
  })

  it('keeps meaning-changing text replacements behind approval', () => {
    const draft = values([QUESTION_ONE])
    const formattingPatch = {
      operation: 'replace_text' as const,
      target: { kind: 'question' as const, id: QUESTION_ONE, field: 'question_text' as const },
      beforeText: 'Which option is correct ?',
      afterText: 'Which option is correct?',
    }
    const meaningPatch = {
      ...formattingPatch,
      afterText: 'Which option is incorrect?',
    }

    expect(automaticFindingStillSafe(draft, finding(formattingPatch))).toBe(true)
    expect(automaticFindingStillSafe(draft, finding(meaningPatch))).toBe(false)
  })
})

describe('bulk import one-click AI fixes', () => {
  it('does not expose model validation internals to tutors', () => {
    expect(bulkImportReviewErrorMessage('[\n  { "code": "too_small", "path": ["repair"] }\n]'))
      .toBe('AI returned an incomplete review. No changes were lost; please retry this stem.')
  })

  it('auto-applies a confident structural fix authorized by starting bulk review', () => {
    const finding: UcatAssessmentFinding = {
      key: 'add-distractor',
      scopeType: 'question',
      questionId: QUESTION_ONE,
      category: 'answer_correctness_fairness',
      rating: 'concern',
      confidence: 0.96,
      title: 'A distractor is missing',
      detail: 'The question needs five options.',
      evidence: [],
      recommendedAction: 'fix',
      suggestion: {
        id: 'add-distractor',
        summary: 'Add a plausible distractor',
        rationale: 'This restores the required option count.',
        application: 'auto_apply',
        patches: [{
          operation: 'insert_option',
          questionId: QUESTION_ONE,
          afterOptionId: null,
          option: {
            id: null,
            answerText: 'Plausible distractor',
            answerExplanation: null,
            isAnswer: false,
          },
        }],
      },
    }

    expect(partitionBulkImportAiFindings([finding])).toEqual({
      automatic: [finding],
      approvalRequired: [],
      manualReview: [],
    })
  })

  it('uses 0.8 as policy, not transport validation, for safe automatic fixes', () => {
    const finding = {
      key: 'fill-explanation',
      scopeType: 'question' as const,
      questionId: QUESTION_ONE,
      category: 'explanation_quality' as const,
      rating: 'concern' as const,
      confidence: 0.8,
      title: 'Missing explanation',
      detail: 'The explanation should teach the method.',
      evidence: [],
      recommendedAction: 'fix' as const,
      suggestion: {
        id: 'fill-explanation',
        summary: 'Add a teaching explanation',
        rationale: 'The current field is empty.',
        application: 'auto_apply' as const,
        patches: [{
          operation: 'set_text' as const,
          target: {
            kind: 'question' as const,
            id: QUESTION_ONE,
            field: 'answer_explanation' as const,
          },
          beforeText: null,
          afterText: 'Work through the evidence before selecting an option.',
        }],
      },
    }

    expect(partitionBulkImportAiFindings([finding]).automatic).toEqual([finding])
    expect(partitionBulkImportAiFindings([{ ...finding, confidence: 0.79 }]))
      .toEqual({ automatic: [], approvalRequired: [{ ...finding, confidence: 0.79 }], manualReview: [] })
  })

  it('isolates a rejected stem request so valid sibling reviews still complete', async () => {
    const originalFetch = global.fetch
    const resultFor = (stem: BulkImportStemDraft) => ({
      id: stem.id,
      promptVersion: 10,
      fingerprints: {
        content: `content:${stem.id}`,
        shared: `shared:${stem.id}`,
        questions: Object.fromEntries(
          stem.values.questions.map((question) => [question.id as string, `question:${question.id}`])
        ),
      },
      assessment: {
        overallSummary: 'No concerns.',
        categories: [],
        findings: [],
      },
      blindSolution: { solutions: [] },
      values: stem.values,
      appliedRepairs: [],
      provenance: null,
      reviewToken: `review-token:${stem.id}`,
      reused: false,
      error: null,
    })
    const fetchMock = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { stems: BulkImportStemDraft[] }
      expect(body.stems).toHaveLength(1)
      const stem = body.stems[0]
      if (stem?.id === STEM_TWO) {
        return {
          ok: false,
          json: async () => ({ error: 'Invalid bulk-review payload.' }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({
          results: stem ? [resultFor(stem)] : [],
          reviewedCount: stem ? 1 : 0,
          reusedCount: 0,
          errorCount: 0,
        }),
      } as Response
    })
    global.fetch = fetchMock

    const { result } = renderHook(() => {
      const [drafts, setDrafts] = useState<BulkImportStemDraft[]>(stems)
      const controller = useBulkImportReviewController({
        stems: drafts,
        onUpdateStem: (stemId, nextValues) => {
          setDrafts((current) => current.map((stem) => (
            stem.id === stemId ? { ...stem, values: nextValues } : stem
          )))
        },
      })
      return controller
    })

    await act(async () => {
      await result.current.runAiReview()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.aiResultsByStemId[STEM_ONE]?.assessment?.overallSummary)
      .toBe('No concerns.')
    expect(result.current.aiErrorsByStemId[STEM_ONE]).toBeUndefined()
    expect(result.current.aiErrorsByStemId[STEM_TWO]).toBe('Invalid bulk-review payload.')

    await act(async () => {
      await result.current.runAiReview()
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual(
      expect.objectContaining({
        stems: [expect.objectContaining({ id: STEM_TWO })],
      })
    )

    global.fetch = originalFetch
  })
})

describe('useBulkImportReviewController approvals', () => {
  it('keeps sibling findings current after approving one edit on the same stem', async () => {
    const firstFinding = {
      key: 'explain-one',
      scopeType: 'question' as const,
      questionId: QUESTION_ONE,
      category: 'explanation_quality' as const,
      rating: 'concern' as const,
      confidence: 0.99,
      title: 'Add an explanation',
      detail: 'The explanation is missing.',
      evidence: [],
      recommendedAction: 'review' as const,
      suggestion: {
        id: 'explain-one',
        summary: 'Add the first explanation',
        rationale: 'Students need worked guidance.',
        application: 'approval_required' as const,
        patches: [{
          operation: 'set_text' as const,
          target: {
            kind: 'question' as const,
            id: QUESTION_ONE,
            field: 'answer_explanation' as const,
          },
          beforeText: null,
          afterText: 'First explanation.',
        }],
      },
    }
    const secondFinding = {
      ...firstFinding,
      key: 'explain-two',
      questionId: QUESTION_TWO,
      title: 'Add another explanation',
      suggestion: {
        ...firstFinding.suggestion,
        id: 'explain-two',
        summary: 'Add the second explanation',
        patches: [{
          operation: 'set_text' as const,
          target: {
            kind: 'question' as const,
            id: QUESTION_TWO,
            field: 'answer_explanation' as const,
          },
          beforeText: null,
          afterText: 'Second explanation.',
        }],
      },
    }
    const reviewResult = {
      id: STEM_ONE,
      promptVersion: 10,
      fingerprints: {
        content: 'content',
        shared: 'shared',
        questions: {
          [QUESTION_ONE]: 'one',
          [QUESTION_TWO]: 'two',
        },
      },
      assessment: {
        overallSummary: 'Two explanations need work.',
        categories: [],
        findings: [firstFinding, secondFinding],
      },
      blindSolution: { solutions: [] },
      values: stems[0].values,
      appliedRepairs: [],
      provenance: null,
      reviewToken: 'review-token',
      reused: false,
      error: null,
    }
    const originalFetch = global.fetch
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [reviewResult],
        reviewedCount: 1,
        reusedCount: 0,
        errorCount: 0,
      }),
    } as Response)
    global.fetch = fetchMock

    const { result } = renderHook(() => {
      const [drafts, setDrafts] = useState<BulkImportStemDraft[]>([stems[0]])
      const controller = useBulkImportReviewController({
        stems: drafts,
        onUpdateStem: (stemId, nextValues) => {
          setDrafts((current) => current.map((stem) => (
            stem.id === stemId ? { ...stem, values: nextValues } : stem
          )))
        },
      })
      return { controller, drafts }
    })

    await act(async () => {
      await result.current.controller.runAiReview()
    })
    expect(result.current.controller.approvalRequiredFindings.map(
      ({ finding }) => finding.key
    )).toEqual(['explain-one', 'explain-two'])
    expect(result.current.controller.aiPhaseByStemId[STEM_ONE]).toBe('manual_review')

    await act(async () => {
      await result.current.controller.approveFinding(STEM_ONE, 'explain-one')
    })

    expect(result.current.controller.staleAiStemIds.has(STEM_ONE)).toBe(true)
    expect(result.current.controller.approvalRequiredFindings.map(
      ({ finding }) => finding.key
    )).toEqual(['explain-two'])
    expect(result.current.drafts[0]?.values.questions[0]?.answerExplanation).not.toBeNull()

    global.fetch = originalFetch
  })
})
