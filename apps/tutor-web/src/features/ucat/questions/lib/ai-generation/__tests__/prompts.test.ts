import {
  AI_GENERATION_SYSTEM_PROMPT,
  buildWriterPrompt,
  getAiGenerationSectionPrompt,
} from '../prompts'
import type { AiGenerationBrief } from '../prompts'
import {
  buildExplanationFillSystemPrompt,
  EXPLANATION_FILL_SYSTEM_PROMPT,
} from '../explanation-prompts'
import { EXPLANATION_TEACHING_RUBRIC } from '../explanation-rubric'

const brief: AiGenerationBrief = {
  sectionName: 'Quantitative Reasoning',
  categoryName: null,
  availableCategories: [{ id: 'charts', name: 'Graphs and Charts' }],
  stemCount: 1,
  difficultyTarget: 'mixed',
  timeBurdenTarget: 'mixed',
  targetTags: [],
  availableTags: [{
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Percentage change',
    path: 'Percentages / Percentage change',
    description: 'Find the percentage increase or decrease between two values.',
    parentId: '22222222-2222-4222-8222-222222222222',
  }],
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
  it('does not impose the obsolete four-question stem maximum', () => {
    const prompt = getAiGenerationSectionPrompt('quantitative_reasoning')
    expect(prompt).not.toContain('between 1 and 4 questions')
    expect(prompt).toContain('one or more questions per stem')
  })

  it('defines optional, non-duplicative explanation layers', () => {
    expect(AI_GENERATION_SYSTEM_PROMPT).toContain('Follow the explanationPolicy')
    expect(AI_GENERATION_SYSTEM_PROMPT).not.toContain('DM and QR explanations')
  })

  it('passes valid tag data and requires every question to be tagged', () => {
    const prompt = buildWriterPrompt({ ...brief, plan: { plans: [{ stemIndex: 0 }] } })
    const payload = JSON.parse(prompt) as {
      brief: { availableQuestionTags: typeof brief.availableTags }
      requirements: string[]
    }

    expect(payload.brief.availableQuestionTags).toEqual(brief.availableTags)
    expect(payload.requirements).toContain(
      'Assign one or more tagIds to every generated question using only exact IDs from availableQuestionTags.'
    )
  })

  it('defines estimated difficulty with the canonical harder-is-higher polarity', () => {
    const prompt = buildWriterPrompt({ ...brief, plan: { plans: [{ stemIndex: 0 }] } })
    const payload = JSON.parse(prompt) as { requirements: string[] }

    expect(payload.requirements).toContainEqual(
      expect.stringContaining('who would answer incorrectly'),
    )
    expect(payload.requirements).toContainEqual(
      expect.stringContaining('0 for easiest and 1 for hardest'),
    )
  })

  it('defines time burden as first-exposure time to correct in authored stem order', () => {
    const prompt = buildWriterPrompt({ ...brief, plan: { plans: [{ stemIndex: 0 }] } })
    const payload = JSON.parse(prompt) as { requirements: string[] }

    expect(payload.requirements).toContainEqual(
      expect.stringContaining('fully correct answer on first exposure'),
    )
    expect(payload.requirements).toContainEqual(
      expect.stringContaining('authored position within the stem'),
    )
  })

  it('allows any purposeful number of QR steps and requires Australian English', () => {
    const prompt = buildWriterPrompt({ ...brief, plan: { plans: [{ stemIndex: 0 }] } })
    const payload = JSON.parse(prompt) as {
      explanationPolicy: string
      sectionRules: string
      requirements: string[]
    }

    expect(payload.sectionRules).toContain('do not impose a fixed number of steps')
    expect(payload.sectionRules).not.toContain('one or two calculation steps')
    expect(payload.explanationPolicy).toContain('Australian English spelling')
    expect(payload.explanationPolicy).toContain('calculator use')
    expect(payload.explanationPolicy).toContain('one direct calculation')
    expect(payload.explanationPolicy).toContain('multiple dependent operations')
    expect(payload.requirements).toContainEqual(expect.stringContaining('Follow explanationPolicy'))
  })

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

describe('explanation fill prompts', () => {
  it('uses the shared teaching rubric and tutor-focused fill workflow', () => {
    expect(EXPLANATION_FILL_SYSTEM_PROMPT).toContain(EXPLANATION_TEACHING_RUBRIC)
    expect(EXPLANATION_FILL_SYSTEM_PROMPT).toContain(
      'Option-level explanations may be included'
    )
    expect(EXPLANATION_FILL_SYSTEM_PROMPT).toContain(
      'Include a question-level explanation only when'
    )
    expect(EXPLANATION_FILL_SYSTEM_PROMPT).toContain('calculator use')
    expect(EXPLANATION_FILL_SYSTEM_PROMPT).toContain('Australian English spelling')
    expect(EXPLANATION_FILL_SYSTEM_PROMPT).toContain(
      'Verbal Reasoning explanations should identify the specific passage evidence'
    )
    expect(EXPLANATION_FILL_SYSTEM_PROMPT).not.toContain(
      'two to five short, titled or numbered steps'
    )
  })

  it('sends only the relevant section explanation policy when the section is known', () => {
    const prompt = buildExplanationFillSystemPrompt({
      sectionName: 'Verbal Reasoning',
    })

    expect(prompt).toContain('specific passage evidence')
    expect(prompt).not.toContain('multiple dependent operations')
    expect(prompt).not.toContain('calculator use')
  })
})

describe('VR writer prompts', () => {
  it('reserves paragraph labels for explanations and prohibits them in passage text', () => {
    const prompt = buildWriterPrompt({
      ...brief,
      sectionName: 'Verbal Reasoning',
      categoryName: 'Reading Comprehension',
      availableCategories: [],
      plan: { plans: [{ stemIndex: 0, categoryName: 'Reading Comprehension' }] },
    })
    const payload = JSON.parse(prompt) as { sectionRules: string; requirements: string[] }

    expect(payload.sectionRules).toContain('Passage paragraphs are unnumbered prose')
    expect(payload.requirements).toContain(
      'Do not write paragraph numbers, labels, or headings inside stemText. Each passage paragraph must begin directly with its prose; Paragraph 1, Paragraph 2, and similar labels are reserved for answerExplanation references only.'
    )
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
