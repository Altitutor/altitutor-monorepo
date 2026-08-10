import {
  UCAT_ANZ_2026_V1,
  evaluateBlueprint,
  type BlueprintComposition,
  type BlueprintSectionCode,
  type BlueprintStem,
} from '..'

const sectionOrder: BlueprintSectionCode[] = [
  'verbal_reasoning',
  'decision_making',
  'quantitative_reasoning',
  'situational_judgement',
]

const stems = (
  section: BlueprintSectionCode,
  category: string,
  questionCounts: number[],
  presentationFormat: BlueprintStem['presentationFormat'] = null,
  answerScheme: BlueprintStem['questions'][number]['answerScheme'] = 'single_choice',
): BlueprintStem[] =>
  questionCounts.map((questionCount, stemIndex) => ({
    id: `${section}-${category}-${questionCounts.length}-${questionCounts.join('-')}-${stemIndex}`,
    category,
    presentationFormat,
    questions: Array.from({ length: questionCount }, (_, questionIndex) => ({
      id: `${section}-${category}-${questionCounts.length}-${questionCounts.join('-')}-${stemIndex}-${questionIndex}`,
      answerScheme,
      optionCount: 4,
      requiredPlacementCount: 0,
    })),
  }))

const passingComposition = (): BlueprintComposition => {
  const vr = [
    ...stems('verbal_reasoning', 'Reading Comprehension', [4, 4, 4, 4, 4, 4, 4, 4]),
    ...stems("verbal_reasoning", "True, False, Can't Tell", [4, 4, 4]),
  ]
  const dm = [
    ...stems('decision_making', 'Syllogisms', [1, 1, 1, 1, 1, 1]),
    ...stems('decision_making', 'Logical Puzzles', [1, 1, 1, 1, 1, 1]),
    ...stems('decision_making', 'Recognising Assumptions', [1, 1, 1, 1]),
    ...stems(
      'decision_making',
      'Interpreting Information and Drawing Conclusions',
      [1, 1, 1],
      'passage',
    ),
    ...stems(
      'decision_making',
      'Interpreting Information and Drawing Conclusions',
      [1, 1],
      'table',
    ),
    ...stems('decision_making', 'Venn Diagrams', [1, 1, 1, 1, 1, 1, 1, 1]),
    ...stems(
      'decision_making',
      'Probabilistic and Statistical Reasoning',
      [1, 1, 1, 1, 1, 1],
    ),
  ]
  const qr = [
    ...stems('quantitative_reasoning', 'Quantitative Reasoning', [4, 4, 4, 4, 4, 4, 4]),
    ...stems('quantitative_reasoning', 'Quantitative Reasoning', [1, 1, 1, 1, 1, 1, 1, 1]),
  ]
  const sjtRating = stems(
    'situational_judgement',
    'How Appropriate',
    [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    'passage',
    'situational_judgement_rating',
  )
  const sjtMostLeast: BlueprintStem[] = Array.from({ length: 3 }, (_, index) => ({
    id: `situational_judgement-most-least-${index}`,
    category: 'Most/Least Appropriate',
    presentationFormat: 'passage',
    questions: [
      {
        id: `situational_judgement-most-least-${index}-0`,
        answerScheme: 'situational_judgement_most_least',
        optionCount: 3,
        requiredPlacementCount: 2,
      },
    ],
  }))

  return {
    purpose: 'full_mock',
    sections: [
      { section: 'verbal_reasoning', answeringTimeSeconds: 1320, instructionTimeSeconds: 90, stems: vr },
      { section: 'decision_making', answeringTimeSeconds: 2220, instructionTimeSeconds: 90, stems: dm },
      { section: 'quantitative_reasoning', answeringTimeSeconds: 1560, instructionTimeSeconds: 120, stems: qr },
      { section: 'situational_judgement', answeringTimeSeconds: 1560, instructionTimeSeconds: 90, stems: [...sjtRating, ...sjtMostLeast] },
    ],
  }
}

describe('UCAT ANZ 2026 v1 blueprint', () => {
  it('keeps exact official facts separate from Altitutor-authored composition policy', () => {
    expect(UCAT_ANZ_2026_V1).toMatchObject({
      id: 'ucat-anz-2026-v1',
      testYear: 2026,
      version: 1,
      official: {
        sections: [
          { section: 'verbal_reasoning', questionCount: 44, answeringTimeSeconds: 1320, instructionTimeSeconds: 90 },
          { section: 'decision_making', questionCount: 35, answeringTimeSeconds: 2220, instructionTimeSeconds: 90 },
          { section: 'quantitative_reasoning', questionCount: 36, answeringTimeSeconds: 1560, instructionTimeSeconds: 120 },
          { section: 'situational_judgement', questionCount: 69, answeringTimeSeconds: 1560, instructionTimeSeconds: 90 },
        ],
      },
    })
    expect(UCAT_ANZ_2026_V1.altitutorPolicy.sectionRules).toHaveLength(4)
    expect(Object.isFrozen(UCAT_ANZ_2026_V1)).toBe(true)
    expect(Object.isFrozen(UCAT_ANZ_2026_V1.official.sections)).toBe(true)
  })

  it('reports a passing full mock with distinct question, stem, and placement totals', () => {
    const result = evaluateBlueprint(UCAT_ANZ_2026_V1, passingComposition())

    expect(result).toEqual(expect.objectContaining({
      applicable: true,
      compliant: true,
      reasons: [],
      totals: { questions: 184, stems: 75, placements: 6 },
    }))
    expect(result.sections.map(section => section.section)).toEqual(sectionOrder)
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'official', label: 'Answering time', unit: 'seconds', compliant: true }),
      expect.objectContaining({ source: 'official', label: 'Instruction time', unit: 'seconds', compliant: true }),
      expect.objectContaining({ source: 'altitutor', label: 'Syllogisms', unit: 'questions', minimum: 5, maximum: 7, compliant: true }),
      expect.objectContaining({ source: 'altitutor', label: 'Most/Least required placements', unit: 'placements', expected: 2, compliant: true }),
    ]))
  })

  it('accepts every allowed-range boundary', () => {
    const composition = passingComposition()
    const dm = composition.sections[1]
    if (!dm) throw new Error('fixture is missing Decision Making')
    dm.stems = [
      ...stems('decision_making', 'Syllogisms', [1, 1, 1, 1, 1, 1, 1]),
      ...stems('decision_making', 'Logical Puzzles', [1, 1, 1, 1, 1, 1]),
      ...stems('decision_making', 'Recognising Assumptions', [1, 1, 1, 1, 1]),
      ...stems('decision_making', 'Interpreting Information and Drawing Conclusions', [1, 1, 1, 1], 'passage'),
      ...stems('decision_making', 'Interpreting Information and Drawing Conclusions', [1], 'graph_or_chart'),
      ...stems('decision_making', 'Venn Diagrams', [1, 1, 1, 1, 1, 1, 1]),
      ...stems('decision_making', 'Probabilistic and Statistical Reasoning', [1, 1, 1, 1, 1]),
    ]

    const result = evaluateBlueprint(UCAT_ANZ_2026_V1, composition)

    expect(result.compliant).toBe(true)
    expect(result.reasons).toEqual([])
  })

  it('returns deterministic reason codes and messages for an impossible composition', () => {
    const composition = passingComposition()
    const dm = composition.sections[1]
    if (!dm) throw new Error('fixture is missing Decision Making')
    dm.answeringTimeSeconds = 2200
    dm.stems = stems('decision_making', 'Syllogisms', Array(35).fill(1))

    const first = evaluateBlueprint(UCAT_ANZ_2026_V1, composition)
    const second = evaluateBlueprint(UCAT_ANZ_2026_V1, composition)

    expect(first).toEqual(second)
    expect(first.reasons.slice(0, 3)).toEqual([
      expect.objectContaining({ code: 'ANSWERING_TIME_MISMATCH', section: 'decision_making' }),
      expect.objectContaining({ code: 'CATEGORY_QUESTION_COUNT_OUT_OF_RANGE', section: 'decision_making', actual: 35 }),
      expect.objectContaining({ code: 'CATEGORY_QUESTION_COUNT_OUT_OF_RANGE', section: 'decision_making', actual: 0 }),
    ])
    expect(first.reasons[0]?.message).toBe('Decision Making answering time must be exactly 2,220 seconds; found 2,200.')
  })

  it('rejects structurally invalid Most/Least and SJT scenario cardinality', () => {
    const composition = passingComposition()
    const sjt = composition.sections[3]
    if (!sjt) throw new Error('fixture is missing Situational Judgement')
    const firstMostLeast = sjt.stems.find(stem => stem.category === 'Most/Least Appropriate')
    if (!firstMostLeast) throw new Error('fixture is missing Most/Least')
    firstMostLeast.questions.push(
      {
        id: 'extra-question',
        answerScheme: 'situational_judgement_most_least',
        optionCount: 4,
        requiredPlacementCount: 1,
      },
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `extra-question-${index}`,
        answerScheme: 'situational_judgement_most_least' as const,
        optionCount: 3,
        requiredPlacementCount: 2,
      })),
    )

    const result = evaluateBlueprint(UCAT_ANZ_2026_V1, composition)

    expect(result.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SJT_SCENARIO_QUESTION_LIMIT_EXCEEDED' }),
      expect.objectContaining({ code: 'MOST_LEAST_STEM_QUESTION_COUNT_INVALID' }),
      expect.objectContaining({ code: 'MOST_LEAST_ACTION_COUNT_INVALID' }),
      expect.objectContaining({ code: 'MOST_LEAST_REQUIRED_PLACEMENTS_INVALID' }),
    ]))
  })

  it('interprets structural and response cardinality values from the supplied blueprint version', () => {
    const composition = passingComposition()
    const changedBlueprint = {
      ...UCAT_ANZ_2026_V1,
      id: 'test-blueprint-v2',
      version: 2,
      altitutorPolicy: {
        ...UCAT_ANZ_2026_V1.altitutorPolicy,
        sectionRules: UCAT_ANZ_2026_V1.altitutorPolicy.sectionRules.map(rule =>
          rule.section === 'quantitative_reasoning'
            ? {
                ...rule,
                structureRules: [
                  { kind: 'stem_count' as const, label: 'Multi-question stems', questionCardinality: 'multiple' as const, min: 8, max: 8 },
                  { kind: 'stem_count' as const, label: 'Single-question stems', questionCardinality: 'single' as const, min: 8, max: 8 },
                ],
              }
            : rule.section === 'situational_judgement'
              ? {
                  ...rule,
                  responseContractRules: rule.responseContractRules?.map(contractRule => ({
                    ...contractRule,
                    optionCount: 4,
                  })),
                }
              : rule,
        ),
      },
    }

    const result = evaluateBlueprint(changedBlueprint, composition)

    expect(result.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'QR_MULTI_STEM_COUNT_OUT_OF_RANGE', minimum: 8, maximum: 8 }),
      expect.objectContaining({ code: 'MOST_LEAST_ACTION_COUNT_INVALID', expected: 4 }),
    ]))
  })

  it('makes a failed scenario check fail the whole evaluation', () => {
    const composition = passingComposition()
    const sjt = composition.sections[3]
    if (!sjt) throw new Error('fixture is missing Situational Judgement')
    sjt.stems.push({ id: 'empty-scenario', category: 'How Important', presentationFormat: 'passage', questions: [] })

    const result = evaluateBlueprint(UCAT_ANZ_2026_V1, composition)

    expect(result.compliant).toBe(false)
    expect(result.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SJT_SCENARIO_QUESTION_LIMIT_EXCEEDED', stemId: 'empty-scenario', minimum: 1 }),
    ]))
  })

  it('counts SJT rating questions by Answer scheme rather than category', () => {
    const composition = passingComposition()
    const sjt = composition.sections[3]
    if (!sjt) throw new Error('fixture is missing Situational Judgement')
    const ratingQuestions = sjt.stems.flatMap(stem => stem.questions).filter(
      question => question.answerScheme === 'situational_judgement_rating',
    )
    const first = ratingQuestions[0]
    const second = ratingQuestions[1]
    if (!first || !second) throw new Error('fixture is missing rating questions')
    first.answerScheme = 'single_choice'
    second.answerScheme = 'single_choice'

    const result = evaluateBlueprint(UCAT_ANZ_2026_V1, composition)

    expect(result.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CATEGORY_QUESTION_COUNT_OUT_OF_RANGE', actual: 64 }),
    ]))
  })

  it('explicitly exempts focused practice from blueprint compliance', () => {
    const result = evaluateBlueprint(UCAT_ANZ_2026_V1, {
      purpose: 'focused_practice',
      sections: [],
    })

    expect(result).toEqual({
      applicable: false,
      compliant: true,
      blueprintId: 'ucat-anz-2026-v1',
      totals: { questions: 0, stems: 0, placements: 0 },
      sections: [],
      checks: [],
      reasons: [
        {
          code: 'FOCUSED_PRACTICE_EXEMPT',
          severity: 'information',
          message: 'Focused practice sets are outside full-mock blueprint compliance.',
        },
      ],
    })
  })
})
