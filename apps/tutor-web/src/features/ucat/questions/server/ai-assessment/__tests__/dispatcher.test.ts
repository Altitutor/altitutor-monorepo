import {
  assessmentDedupeKey,
  dispatchUcatQuestionAssessmentQueueMessage,
  type UcatQuestionAssessmentQueueMessage,
} from '@/features/ucat/questions/server/ai-assessment/dispatcher'

describe('UCAT question assessment queue consumer', () => {
  it('does not deduplicate reviews across review-contract versions', () => {
    const base = {
      cycleId: 'cycle',
      fingerprint: 'fingerprint',
      scopeType: 'full' as const,
      questionIds: ['question'],
    }
    expect(assessmentDedupeKey({ ...base, promptVersion: 17 }))
      .not.toBe(assessmentDedupeKey({ ...base, promptVersion: 18 }))
  })

  it('prepares an automatic assessment only after the preparation message reaches the queue', async () => {
    const message: UcatQuestionAssessmentQueueMessage = {
      kind: 'prepare',
      stemIds: ['01f44d22-345e-806c-a3c1-c05665d6a1dc'],
      triggerKind: 'content_change',
      requestedBy: null,
    }
    const prepare = jest.fn().mockResolvedValue(undefined)
    const run = jest.fn().mockResolvedValue(undefined)

    await dispatchUcatQuestionAssessmentQueueMessage(message, { prepare, run })

    expect(prepare).toHaveBeenCalledWith({
      kind: 'prepare',
      stemIds: message.stemIds,
      triggerKind: 'content_change',
      requestedBy: null,
    })
    expect(run).not.toHaveBeenCalled()
  })
})
