import {
  automaticFindingStillSafe,
  deriveIncludedBulkImportStems,
} from '@/features/ucat/questions/hooks/useBulkImportReviewController'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { UcatAssessmentFinding } from '@/features/ucat/questions/lib/ai-assessment/schema'

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
