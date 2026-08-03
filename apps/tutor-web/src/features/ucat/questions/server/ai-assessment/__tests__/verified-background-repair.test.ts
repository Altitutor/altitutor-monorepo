import { backgroundRepairPatchAllowed } from '@/features/ucat/questions/server/ai-assessment/verified-background-repair'
import type {
  UcatAssessmentPatch,
  UcatAssessmentSnapshot,
  UcatFormatCheck,
} from '@/features/ucat/questions/lib/ai-assessment/schema'

const questionId = '30000000-0000-4000-8000-000000000001'
const optionId = '40000000-0000-4000-8000-000000000001'

const snapshot = {
  stemId: '20000000-0000-4000-8000-000000000001',
  status: 'in_review',
  sectionId: '10000000-0000-4000-8000-000000000001',
  sectionName: 'Decision Making',
  sectionNumber: 2,
  displayColumns: 1,
  categoryId: null,
  categoryName: null,
  accessScope: 'public',
  stemText: {},
  stemTextPlain: 'Stem',
  images: [],
  questions: [{
    id: questionId,
    index: 1,
    questionText: {},
    questionTextPlain: 'Question',
    answerExplanation: null,
    answerExplanationPlain: '',
    questionType: 'multiple_choice',
    difficulty: null,
    timeBurdenSeconds: null,
    tagIds: [],
    tagNames: [],
    images: [],
    options: [{
      id: optionId,
      index: 1,
      answerText: {},
      answerTextPlain: 'A',
      answerExplanation: null,
      answerExplanationPlain: '',
      isAnswer: true,
      images: [],
    }],
  }],
} satisfies UcatAssessmentSnapshot

function check(code: string): UcatFormatCheck {
  return {
    code,
    message: code,
    severity: 'error',
    scopeType: 'question',
    questionId,
    questionIndex: 1,
  }
}

function allowed(patch: UcatAssessmentPatch, formatChecks: UcatFormatCheck[]): boolean {
  return backgroundRepairPatchAllowed({ patch, snapshot, formatChecks })
}

describe('verified background repair policy', () => {
  it('allows missing explanations and missing options only when a matching gate failed', () => {
    const explanationPatch: UcatAssessmentPatch = {
      operation: 'set_text',
      target: { kind: 'question', id: questionId, field: 'answer_explanation' },
      beforeText: null,
      afterText: 'Worked explanation',
    }
    const optionPatch: UcatAssessmentPatch = {
      operation: 'insert_option',
      questionId,
      afterOptionId: optionId,
      option: { answerText: 'B', isAnswer: false },
    }
    expect(allowed(explanationPatch, [check('missing_question_explanation')])).toBe(true)
    expect(allowed(explanationPatch, [])).toBe(false)
    expect(allowed(optionPatch, [check('dm_assumption_option_count')])).toBe(true)
    expect(allowed(optionPatch, [check('missing_question_explanation')])).toBe(false)
  })

  it('always sends answer-key corrections through the independent verifier', () => {
    expect(allowed({
      operation: 'set_answer_key',
      questionId,
      currentCorrectOptionId: optionId,
      correctOptionId: optionId,
    }, [])).toBe(true)
  })

  it('does not auto-apply unrelated metadata improvements', () => {
    expect(allowed({
      operation: 'set_metadata',
      targetKind: 'question',
      targetId: questionId,
      field: 'difficulty',
      before: null,
      after: 0.5,
    }, [check('missing_question_explanation')])).toBe(false)
  })
})
