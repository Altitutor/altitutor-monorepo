import {
  auditDecisionMakingCategoryRecords,
  buildDecisionMakingCategoryAuditReport,
  type DecisionMakingAuditRecord,
} from '../decisionMakingCategoryAudit'

const textDoc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})

function record(
  overrides: Partial<DecisionMakingAuditRecord> = {}
): DecisionMakingAuditRecord {
  return {
    stem_id: '10000000-0000-4000-8000-000000000001',
    current_category: 'Syllogisms',
    stem_text: textDoc('All artists are readers. No readers are pilots.'),
    status: 'published',
    deleted_at: null,
    questions: [
      {
        id: '20000000-0000-4000-8000-000000000001',
        question_text: textDoc('Determine which conclusions follow.'),
        deleted_at: null,
      },
    ],
    ...overrides,
  }
}

describe('auditDecisionMakingCategoryRecords', () => {
  it('reports stable IDs, lifecycle, rich presentation, and semantic evidence', () => {
    const stemText = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Survey data by region' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }

    expect(
      auditDecisionMakingCategoryRecords([
        record({
          stem_text: stemText,
          questions: [
            {
              id: '20000000-0000-4000-8000-000000000001',
              question_text: textDoc('Determine which conclusions follow.'),
              deleted_at: null,
            },
            {
              id: '20000000-0000-4000-8000-000000000002',
              question_text: textDoc('Determine which conclusion follows.'),
              deleted_at: '2026-07-01T00:00:00Z',
            },
          ],
        }),
      ])
    ).toEqual([
      expect.objectContaining({
        stemId: '10000000-0000-4000-8000-000000000001',
        currentCategory: 'Syllogisms',
        stemLifecycle: 'active',
        activeQuestionIds: ['20000000-0000-4000-8000-000000000001'],
        softDeletedQuestionIds: ['20000000-0000-4000-8000-000000000002'],
        observedPresentationFormats: ['table'],
        richNodeTypes: ['table', 'tableCell', 'tableRow'],
        formalPremiseSignals: [],
        factualDataSignals: ['data', 'survey'],
        suggestedCategory: 'Interpreting Information and Drawing Conclusions',
        confidence: 'strong',
        evidence: ['prose_information_presentation'],
        conflicts: [],
        requiresHumanReview: false,
      }),
    ])
  })

  it('includes stem-deleted content and prefers Interpreting Information for visual stems', () => {
    expect(
      auditDecisionMakingCategoryRecords([
        record({
          stem_text: textDoc(
            'A survey table states that all artists are readers and no readers are pilots.'
          ),
          deleted_at: '2026-07-02T00:00:00Z',
        }),
      ])[0]
    ).toMatchObject({
      stemLifecycle: 'stem_deleted',
      suggestedCategory: 'Interpreting Information and Drawing Conclusions',
      confidence: 'strong',
      evidence: ['visual_presentation'],
      conflicts: [],
      requiresHumanReview: false,
    })
  })

  it('keeps signed asset URLs out of the checked audit evidence', () => {
    const row = auditDecisionMakingCategoryRecords([
      record({
        stem_text: {
          type: 'doc',
          content: [
            {
              type: 'image',
              attrs: {
                src: 'https://example.test/private.png?token=secret',
                fileId: '30000000-0000-4000-8000-000000000001',
                alt: 'A labelled probability diagram',
              },
            },
          ],
        },
      }),
    ])[0]!

    expect(row.stemTextExcerpt).toBe('A labelled probability diagram')
    expect(row.stemTextExcerpt).not.toContain('secret')
    expect(row.assetFileIds).toEqual([
      '30000000-0000-4000-8000-000000000001',
    ])
    expect(row.observedPresentationFormats).toEqual(['diagram_or_image'])
  })

  it('summarises every lifecycle and keeps review rows explicit', () => {
    const report = buildDecisionMakingCategoryAuditReport([
      record(),
      record({
        stem_id: '10000000-0000-4000-8000-000000000002',
        stem_text: textDoc('A table reports trial results by year.'),
        deleted_at: '2026-07-02T00:00:00Z',
      }),
      record({
        stem_id: '10000000-0000-4000-8000-000000000003',
        stem_text: textDoc('An ordinary statement without enough evidence.'),
      }),
    ])

    expect(report.summary).toEqual({
      totalStems: 3,
      activeStems: 2,
      stemDeletedStems: 1,
      activeQuestions: 3,
      softDeletedQuestions: 0,
      suggestedSyllogisms: 1,
      suggestedInterpretingInformation: 2,
      requiresHumanReview: 0,
    })
    expect(report.rows.map((row) => row.stemId)).toEqual([
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003',
    ])
  })
})
