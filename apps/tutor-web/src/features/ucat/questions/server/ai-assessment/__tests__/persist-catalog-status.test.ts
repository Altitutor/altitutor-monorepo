import { AI_ASSESSMENT_PROMPT_VERSION } from '@/features/ucat/questions/lib/ai-assessment/schema'
import {
  persistStemAiReviewStatus,
  type PersistStemAiReviewStatusPorts,
} from '@/features/ucat/questions/server/ai-assessment/persist-catalog-status'
import type { UcatAiReviewSummaryRun } from '@/features/ucat/questions/server/ai-assessment/status-summary'

const q1 = '00000000-0000-4000-8000-000000000001'

function makePorts(overrides: Partial<PersistStemAiReviewStatusPorts> = {}): PersistStemAiReviewStatusPorts {
  return {
    loadSummaryInputs: async () => null,
    writeCatalogStatus: async () => undefined,
    ...overrides,
  }
}

function completedPassRun(overrides: Partial<UcatAiReviewSummaryRun> = {}): UcatAiReviewSummaryRun {
  return {
    id: 'run-1',
    cycle_id: 'cycle-1',
    scope_type: 'full',
    target_question_ids: [q1],
    shared_fingerprint: 'shared-fp',
    question_fingerprints: { [q1]: 'q-fp' },
    status: 'completed',
    prompt_version: AI_ASSESSMENT_PROMPT_VERSION,
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
    requested_at: '2026-08-12T00:00:00.000Z',
    started_at: '2026-08-12T00:00:01.000Z',
    ...overrides,
  }
}

describe('persistStemAiReviewStatus', () => {
  it('persists the durable summarizer status and never writes disabled', async () => {
    const writeCatalogStatus = jest.fn().mockResolvedValue(undefined)
    const status = await persistStemAiReviewStatus('stem-1', makePorts({
      loadSummaryInputs: async () => ({
        currentCycleId: 'cycle-1',
        runs: [completedPassRun()],
        fingerprints: {
          shared: 'shared-fp',
          questions: { [q1]: 'q-fp' },
          content: 'content-fp',
        },
        questionIds: [q1],
      }),
      writeCatalogStatus,
    }))

    expect(status).toBe('passed')
    expect(writeCatalogStatus).toHaveBeenCalledWith('stem-1', 'passed')
  })

  it('persists not_requested when fingerprints no longer match completed runs', async () => {
    const writeCatalogStatus = jest.fn().mockResolvedValue(undefined)
    const status = await persistStemAiReviewStatus('stem-1', makePorts({
      loadSummaryInputs: async () => ({
        currentCycleId: 'cycle-1',
        runs: [completedPassRun()],
        fingerprints: {
          shared: 'shared-fp-changed',
          questions: { [q1]: 'q-fp-changed' },
          content: 'content-fp-changed',
        },
        questionIds: [q1],
      }),
      writeCatalogStatus,
    }))

    expect(status).toBe('not_requested')
    expect(writeCatalogStatus).toHaveBeenCalledWith('stem-1', 'not_requested')
  })

  it('returns null without writing when the stem cannot be loaded', async () => {
    const writeCatalogStatus = jest.fn().mockResolvedValue(undefined)
    const status = await persistStemAiReviewStatus('missing', makePorts({
      writeCatalogStatus,
    }))

    expect(status).toBeNull()
    expect(writeCatalogStatus).not.toHaveBeenCalled()
  })
})
