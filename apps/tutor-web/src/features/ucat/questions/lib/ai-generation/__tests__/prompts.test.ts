import { AI_GENERATION_SYSTEM_PROMPT, buildWriterPrompt } from '../prompts'
import type { AiGenerationBrief } from '../prompts'

const brief: AiGenerationBrief = {
  sectionName: 'Quantitative Reasoning',
  categoryName: null,
  availableCategories: [{ id: 'charts', name: 'Graphs and Charts' }],
  stemCount: 1,
  difficultyTarget: 'mixed',
  timeBurdenTarget: 'mixed',
  targetTags: [],
  examples: [{ id: 'source', categoryName: 'Graphs and Charts' }],
  presentationReference: {
    id: 'source',
    categoryName: 'Graphs and Charts',
    stemText: 'A source chart.',
  },
  sourceImagesForCalibration: [{ sourceStemId: 'source', imageIndex: 1 }],
  promptLayers: [],
}

describe('QR writer prompts', () => {
  it('does not discourage source visuals or prohibit visual composition calibration', () => {
    const prompt = buildWriterPrompt({ ...brief, plan: { plans: [{ stemIndex: 0 }] } })
    const payload = JSON.parse(prompt) as { requirements: string[] }

    expect(AI_GENERATION_SYSTEM_PROMPT).not.toContain('Avoid image-dependent questions')
    expect(prompt).not.toContain('Use a source visual only where')
    expect(prompt).not.toContain('visual composition')
    expect(prompt).toContain('The designated presentation reference is a real Graphs and Charts stem')
    expect(prompt).toContain('new stem MUST use that same broad presentation family')
    expect(payload.requirements).toContain('Set categoryName exactly to "Graphs and Charts" after writing.')
  })
})

describe('DM Venn writer prompts', () => {
  it('preserves complex multi-shape diagrams and diagram answer options', () => {
    const prompt = buildWriterPrompt({
      ...brief,
      sectionName: 'Decision Making',
      categoryName: 'Venn Diagrams',
      availableCategories: [{ id: 'venn', name: 'Venn Diagrams' }],
      presentationReference: undefined,
      plan: { plans: [{ stemIndex: 0, categoryName: 'Venn Diagrams' }] },
    })

    expect(prompt).toContain('three or more sets, nested sets, mixed overlapping circles, ellipses, rectangles, triangles, diamonds, pentagons, hexagons, crosses, or explicit polygon shapes')
    expect(prompt).toContain('Diagram answer options are fully supported')
    expect(prompt).not.toContain('Use two or three labelled circles or ellipses only')
    expect(prompt).not.toContain('do not create diagram answer options')
  })

  it('uses a real Venn source as the broad structural target without imposing a batch quota', () => {
    const prompt = buildWriterPrompt({
      ...brief,
      sectionName: 'Decision Making',
      categoryName: 'Venn Diagrams',
      availableCategories: [{ id: 'venn', name: 'Venn Diagrams' }],
      presentationReference: undefined,
      vennStructureReference: {
        id: 'diagram-options-source',
        stemText: 'Three set relationships are described in prose.',
        questions: [{ questionText: 'Which diagram is correct?', options: ['image A', 'image B'] }],
        diagramLocation: 'answer_options',
      },
      plan: { plans: [{ stemIndex: 0, categoryName: 'Venn Diagrams' }] },
    })

    expect(prompt).toContain('requiredVennDiagramLocation=answer_options')
    expect(prompt).toContain('Return no Venn/set visual in stemText')
    expect(prompt).toContain('each option answerText must be an array containing its own visual block')
    expect(prompt).toContain('Do not reduce a four-set or five-set reference to three sets')
    expect(prompt).toContain('Do not trace or clone the exact composition')
    expect(prompt).not.toContain('exactly one answer-option diagram question')
  })
})
