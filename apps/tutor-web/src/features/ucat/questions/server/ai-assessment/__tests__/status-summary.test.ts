import { summarizeCurrentUcatAiReview, type UcatAiReviewSummaryRun } from '../status-summary'
import { AI_ASSESSMENT_PROMPT_VERSION } from '@/features/ucat/questions/lib/ai-assessment/schema'

const q1 = '00000000-0000-4000-8000-000000000001'
const q2 = '00000000-0000-4000-8000-000000000002'

const fingerprints = {
  content: 'content-current',
  shared: 'shared-current',
  questions: { [q1]: 'q1-current', [q2]: 'q2-current' },
}

function run(overrides: Partial<UcatAiReviewSummaryRun> = {}): UcatAiReviewSummaryRun {
  return {
    id: 'run-1',
    cycle_id: 'cycle-1',
    scope_type: 'full',
    target_question_ids: [q1, q2],
    shared_fingerprint: 'shared-current',
    question_fingerprints: { [q1]: 'q1-current', [q2]: 'q2-current' },
    status: 'completed',
    prompt_version: AI_ASSESSMENT_PROMPT_VERSION,
    requested_at: '2026-08-04T00:00:00.000Z',
    assessment_result: {
      overallSummary: 'Pass',
      categories: [{
        category: 'presentation_integrity',
        scopeType: 'question',
        questionId: q1,
        rating: 'pass',
        confidence: 0.9,
        summary: 'Pass',
        evidence: [],
      }],
      findings: [],
    },
    ...overrides,
  }
}

describe('summarizeCurrentUcatAiReview', () => {
  it('reports the current completed review', () => {
    expect(summarizeCurrentUcatAiReview({
      environmentEnabled: true,
      currentCycleId: 'cycle-1',
      runs: [run()],
      fingerprints,
      questionIds: [q1, q2],
    })).toEqual({ status: 'passed', effectiveRunIds: ['run-1'] })
  })

  it('ignores a stale review after content changes', () => {
    expect(summarizeCurrentUcatAiReview({
      environmentEnabled: true,
      currentCycleId: 'cycle-1',
      runs: [run({ shared_fingerprint: 'old', question_fingerprints: { [q1]: 'old', [q2]: 'old' } })],
      fingerprints,
      questionIds: [q1, q2],
    }).status).toBe('not_requested')
  })

  it('ignores a review produced by an older review contract', () => {
    expect(summarizeCurrentUcatAiReview({
      environmentEnabled: true,
      currentCycleId: 'cycle-1',
      runs: [run({ prompt_version: AI_ASSESSMENT_PROMPT_VERSION - 1 })],
      fingerprints,
      questionIds: [q1, q2],
    })).toEqual({ status: 'not_requested', effectiveRunIds: [] })
  })

  it('keeps the publication gate on the same review contract version', () => {
    expect(AI_ASSESSMENT_PROMPT_VERSION).toBe(19)
  })

  it('combines current partial runs and preserves the worst result', () => {
    const concern = run({
      id: 'run-2',
      scope_type: 'questions',
      target_question_ids: [q2],
      assessment_result: {
        overallSummary: 'Concern',
        categories: [{
          category: 'difficulty_timing',
          scopeType: 'question',
          questionId: q2,
          rating: 'concern',
          confidence: 0.9,
          summary: 'Concern',
          evidence: [],
        }],
        findings: [],
      },
    })
    expect(summarizeCurrentUcatAiReview({
      environmentEnabled: true,
      currentCycleId: 'cycle-1',
      runs: [concern, run()],
      fingerprints,
      questionIds: [q1, q2],
    }).status).toBe('concerns')
  })

  it('uses the newest current review for each question', () => {
    const olderConcern = run({
      id: 'older-full',
      requested_at: '2026-08-03T00:00:00.000Z',
      assessment_result: {
        overallSummary: 'Old concern',
        categories: [{
          category: 'difficulty_timing',
          scopeType: 'question',
          questionId: q1,
          rating: 'concern',
          confidence: 0.9,
          summary: 'Old concern',
          evidence: [],
        }],
        findings: [],
      },
    })
    const newerPass = run({
      id: 'newer-question',
      scope_type: 'questions',
      target_question_ids: [q1],
      requested_at: '2026-08-04T00:00:00.000Z',
    })
    expect(summarizeCurrentUcatAiReview({
      environmentEnabled: true,
      currentCycleId: 'cycle-1',
      runs: [olderConcern, newerPass],
      fingerprints,
      questionIds: [q1],
    }).status).toBe('passed')
  })

  it('does not report an abandoned running review as reviewing forever', () => {
    expect(summarizeCurrentUcatAiReview({
      environmentEnabled: true,
      currentCycleId: 'cycle-1',
      runs: [run({
        status: 'running',
        started_at: '2026-08-04T00:00:00.000Z',
      })],
      fingerprints,
      questionIds: [q1, q2],
      now: new Date('2026-08-04T00:10:00.001Z'),
    }).status).toBe('unavailable')
  })

  it('continues to report a recently started review as reviewing', () => {
    expect(summarizeCurrentUcatAiReview({
      environmentEnabled: true,
      currentCycleId: 'cycle-1',
      runs: [run({
        status: 'running',
        started_at: '2026-08-04T00:05:00.000Z',
      })],
      fingerprints,
      questionIds: [q1, q2],
      now: new Date('2026-08-04T00:10:00.000Z'),
    }).status).toBe('reviewing')
  })

  it('reports the environment kill switch', () => {
    expect(summarizeCurrentUcatAiReview({
      environmentEnabled: false,
      currentCycleId: 'cycle-1',
      runs: [run()],
      fingerprints,
      questionIds: [q1, q2],
    }).status).toBe('disabled')
  })
})
