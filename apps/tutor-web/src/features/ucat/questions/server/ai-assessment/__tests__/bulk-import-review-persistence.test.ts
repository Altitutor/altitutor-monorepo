import {
  AI_ASSESSMENT_PROMPT_VERSION,
  type UcatAssessmentSnapshot,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import { fingerprintUcatAssessmentSnapshot } from '@/features/ucat/questions/server/ai-assessment/content'
import { selectFreshBulkImportAiReview } from '@/features/ucat/questions/server/ai-assessment/bulk-import-review-persistence'
import { issueBulkImportReviewToken } from '@/features/ucat/questions/server/ai-assessment/bulk-import-review-token'

process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-bulk-import-review-signing-secret'

const STEM_ID = '10000000-0000-4000-8000-000000000001'
const QUESTION_ID = '20000000-0000-4000-8000-000000000001'
const OPTION_ID = '30000000-0000-4000-8000-000000000001'

function snapshot(questionText = 'Which answer is correct?'): UcatAssessmentSnapshot {
  return {
    stemId: STEM_ID,
    status: 'in_review',
    sourceChannel: 'bulk_import',
    sectionId: '40000000-0000-4000-8000-000000000001',
    sectionName: 'Verbal Reasoning',
    sectionNumber: 1,
    displayColumns: 1,
    categoryId: null,
    categoryName: null,
    accessScope: 'public',
    stemText: { type: 'doc', content: [] },
    stemTextPlain: '',
    images: [],
    questions: [{
      id: QUESTION_ID,
      index: 1,
      questionText: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: questionText }] }],
      },
      questionTextPlain: questionText,
      answerExplanation: null,
      answerExplanationPlain: '',
      questionType: 'multiple_choice',
      difficulty: 3,
      timeBurdenSeconds: 60,
      tagIds: [],
      tagNames: [],
      images: [],
      options: [{
        id: OPTION_ID,
        index: 1,
        answerText: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Answer' }] }],
        },
        answerTextPlain: 'Answer',
        answerExplanation: null,
        answerExplanationPlain: '',
        isAnswer: true,
        images: [],
      }],
    }],
  }
}

function reviewFor(current: UcatAssessmentSnapshot) {
  const review = {
    draftStemId: STEM_ID,
    promptVersion: AI_ASSESSMENT_PROMPT_VERSION,
    fingerprints: fingerprintUcatAssessmentSnapshot(current),
    assessment: {
      overallSummary: 'The question is ready for review.',
      categories: [],
      findings: [],
    },
    blindSolution: {
      solutions: [{
        questionId: QUESTION_ID,
        selectedOptionId: OPTION_ID,
        syllogismAnswers: [],
        justification: 'The supplied answer follows from the question.',
        confidence: 0.99,
        ambiguous: false,
        unsolvable: false,
      }],
    },
  }
  return {
    ...review,
    reviewToken: issueBulkImportReviewToken({
      draftStemId: review.draftStemId,
      promptVersion: review.promptVersion,
      fingerprints: review.fingerprints,
      assessment: review.assessment,
      blindSolution: review.blindSolution,
      provenance: null,
    }),
  }
}

function resignReview<T extends ReturnType<typeof reviewFor>>(review: T): T {
  return {
    ...review,
    reviewToken: issueBulkImportReviewToken({
      draftStemId: review.draftStemId,
      promptVersion: review.promptVersion,
      fingerprints: review.fingerprints,
      assessment: review.assessment,
      blindSolution: review.blindSolution,
      provenance: null,
    }),
  }
}

describe('bulk-import AI review persistence freshness gate', () => {
  it('accepts a complete review for the exact stable imported snapshot', () => {
    const current = snapshot()

    expect(selectFreshBulkImportAiReview({
      stemId: STEM_ID,
      snapshot: current,
      review: reviewFor(current),
    })).toMatchObject({ ok: true })
  })

  it('rejects a review after the imported question content changes', () => {
    const reviewed = snapshot()
    const imported = snapshot('Which answer is definitely correct?')

    expect(selectFreshBulkImportAiReview({
      stemId: STEM_ID,
      snapshot: imported,
      review: reviewFor(reviewed),
    })).toEqual({ ok: false, reason: 'content_changed_after_review' })
  })

  it('rejects a review attached to a different stable stem ID', () => {
    const current = snapshot()

    expect(selectFreshBulkImportAiReview({
      stemId: '10000000-0000-4000-8000-000000000002',
      snapshot: { ...current, stemId: '10000000-0000-4000-8000-000000000002' },
      review: reviewFor(current),
    })).toEqual({ ok: false, reason: 'stem_id_mismatch' })
  })

  it('accepts a conditional blind solution that covers only discrepant questions', () => {
    const current = snapshot()
    const review = reviewFor(current)

    expect(selectFreshBulkImportAiReview({
      stemId: STEM_ID,
      snapshot: current,
      review: resignReview({
        ...review,
        blindSolution: { solutions: [] },
      }),
    })).toMatchObject({ ok: true })
  })

  it('rejects a Keep as-is decision for a finding that was not in the review', () => {
    const current = snapshot()
    const review = reviewFor(current)

    expect(selectFreshBulkImportAiReview({
      stemId: STEM_ID,
      snapshot: current,
      review: {
        ...review,
        decisions: [{ findingKey: 'missing-finding', decision: 'dismissed' }],
      },
    })).toEqual({ ok: false, reason: 'invalid_finding_decision' })
  })

  it('rejects a client-modified assessment result', () => {
    const current = snapshot()
    const review = reviewFor(current)

    expect(selectFreshBulkImportAiReview({
      stemId: STEM_ID,
      snapshot: current,
      review: {
        ...review,
        assessment: {
          ...review.assessment,
          overallSummary: 'Client-authored clean review',
        },
      },
    })).toEqual({ ok: false, reason: 'invalid_review_token' })
  })
})
