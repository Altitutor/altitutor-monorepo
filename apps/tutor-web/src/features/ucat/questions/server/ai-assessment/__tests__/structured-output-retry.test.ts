import { z } from 'zod'
import { runWithStructuredOutputRetry } from '../structured-output-retry'
import { normalizeDuplicateAssessmentFindingKeys } from '../normalize-assessment'

describe('runWithStructuredOutputRetry', () => {
  it('retries one invalid structured response with corrective context', async () => {
    const calls: Array<{ attempt: number; previousError: string | null }> = []
    const result = await runWithStructuredOutputRetry(async (context) => {
      calls.push(context)
      if (context.attempt === 0) z.string().parse(42)
      return 'valid'
    })

    expect(result).toBe('valid')
    expect(calls).toEqual([
      { attempt: 0, previousError: null },
      expect.objectContaining({ attempt: 1, previousError: expect.any(String) }),
    ])
  })

  it('retries semantic target validation failures', async () => {
    let attempts = 0
    await expect(runWithStructuredOutputRetry(async () => {
      attempts += 1
      throw new Error('Assessment returned a finding outside the requested scope')
    })).rejects.toThrow('Assessment returned a finding outside the requested scope')
    expect(attempts).toBe(2)
  })

  it('does not retry operational failures', async () => {
    let attempts = 0
    await expect(runWithStructuredOutputRetry(async () => {
      attempts += 1
      throw new Error('Provider timed out')
    })).rejects.toThrow('Provider timed out')
    expect(attempts).toBe(1)
  })
})

describe('normalizeDuplicateAssessmentFindingKeys', () => {
  it('keeps repeated model finding keys addressable across questions', () => {
    const finding = {
      key: 'missing-explanation',
      scopeType: 'question' as const,
      category: 'explanation_quality' as const,
      rating: 'critical' as const,
      confidence: 0.99,
      title: 'Missing explanation',
      detail: 'Add an explanation.',
      evidence: [],
      recommendedAction: 'fix' as const,
      suggestion: null,
    }
    const assessment = normalizeDuplicateAssessmentFindingKeys({
      overallSummary: 'Two questions need explanations.',
      categories: [],
      findings: [
        { ...finding, questionId: '30000000-0000-4000-8000-000000000001' },
        { ...finding, questionId: '30000000-0000-4000-8000-000000000002' },
      ],
    })

    expect(assessment.findings.map((item) => item.key)).toHaveLength(2)
    expect(new Set(assessment.findings.map((item) => item.key)).size).toBe(2)
    expect(assessment.findings[0]?.key).toBe('missing-explanation')
  })
})
