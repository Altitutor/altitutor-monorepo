import type { UcatGenerationRun } from '@/features/ucat/questions/api/questions'
import {
  parseUcatGenerationNotificationMetadata,
  resolveGenerationNotificationProgress,
} from '../ucat-generation-notification'

function makeRun(overrides: Partial<UcatGenerationRun> = {}): UcatGenerationRun {
  return {
    id: 'run-1',
    status: 'running',
    requested_stem_count: 5,
    accepted_stem_count: 0,
    discarded_stem_count: 0,
    processed_stem_count: 2,
    progress_step: 'generating',
    progress_message: 'Generating stem 2 of 5',
    error_message: null,
    generated_stem_ids: [],
    created_at: '2026-07-19T00:00:00.000Z',
    completed_at: null,
    dismissed_at: null,
    ...overrides,
  }
}

describe('parseUcatGenerationNotificationMetadata', () => {
  it('parses running metadata', () => {
    expect(parseUcatGenerationNotificationMetadata({
      generationRunId: 'run-1',
      status: 'running',
      requestedStemCount: 5,
      processedStemCount: 1,
      progressMessage: 'Queued',
    })).toEqual({
      generationRunId: 'run-1',
      status: 'running',
      requestedStemCount: 5,
      processedStemCount: 1,
      stemCount: undefined,
      progressMessage: 'Queued',
      message: undefined,
    })
  })

  it('treats legacy completion metadata as completed', () => {
    expect(parseUcatGenerationNotificationMetadata({
      generationRunId: 'run-1',
      stemCount: 3,
    })).toEqual({
      generationRunId: 'run-1',
      status: 'completed',
      stemCount: 3,
    })
  })
})

describe('resolveGenerationNotificationProgress', () => {
  it('prefers live run progress while generation is running', () => {
    const progress = resolveGenerationNotificationProgress({
      notificationType: 'ucat.ai_generation.running',
      metadata: {
        generationRunId: 'run-1',
        status: 'running',
        requestedStemCount: 5,
        processedStemCount: 0,
        progressMessage: 'Generation queued',
      },
      body: 'Generating questions…',
      run: makeRun(),
    })

    expect(progress).toEqual({
      status: 'running',
      message: 'Generating stem 2 of 5',
      processed: 2,
      total: 5,
      percent: 40,
      runId: 'run-1',
    })
  })

  it('marks completed notifications at 100%', () => {
    const progress = resolveGenerationNotificationProgress({
      notificationType: 'ucat.ai_generation.completed',
      metadata: {
        generationRunId: 'run-1',
        status: 'completed',
        stemCount: 4,
      },
      body: '4 question stems are ready.',
      run: null,
    })

    expect(progress).toMatchObject({
      status: 'completed',
      percent: 100,
      processed: 4,
      runId: 'run-1',
    })
  })
})
