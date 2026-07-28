import { buildLocalPlan } from '../local-plan'
import type { AiGenerationBrief } from '../prompts'

const brief: AiGenerationBrief = {
  sectionName: 'Quantitative Reasoning',
  categoryName: null,
  availableCategories: [
    { id: 'tables', name: 'Data Tables' },
    { id: 'charts', name: 'Graphs and Charts' },
  ],
  stemCount: 1,
  difficultyTarget: 'mixed',
  timeBurdenTarget: 'mixed',
  targetTags: [],
  availableTags: [],
  examples: [{ id: 'pie-chart-source', categoryName: 'Graphs and Charts' }],
  promptLayers: [],
}

describe('buildLocalPlan', () => {
  it('does not preselect a category or source format for unfiltered QR', () => {
    const plan = buildLocalPlan(brief, 0)
    const row = (plan.plans as Array<Record<string, unknown>>)[0]

    expect(row).toEqual(expect.objectContaining({
      stemIndex: 0,
      categoryRole: expect.stringContaining('do not preselect a category or source format'),
    }))
    expect(row.categoryName).toBeUndefined()
    expect(row.scenarioDomain).toBeUndefined()
    expect(row.questionArchetype).toBeUndefined()
  })
})
