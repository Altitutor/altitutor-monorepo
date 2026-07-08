import { validateGeneratedStemCandidate } from '../gates'
import type { GeneratedStem } from '../schema'

function mcQuestion(overrides: Partial<GeneratedStem['questions'][number]> = {}): GeneratedStem['questions'][number] {
  return {
    questionText: 'Which option is correct?',
    questionType: 'multiple_choice',
    answerExplanation:
      'A is correct because it follows directly from the stem. B, C and D are wrong because they contradict the stated facts.',
    difficultyTarget: 'medium',
    timeBurdenTarget: 'medium',
    estimatedDifficulty: 0.5,
    estimatedTimeBurdenSeconds: 80,
    tagIds: [],
    options: [
      { answerText: 'A', isAnswer: true, answerExplanation: null },
      { answerText: 'B', isAnswer: false, answerExplanation: null },
      { answerText: 'C', isAnswer: false, answerExplanation: null },
      { answerText: 'D', isAnswer: false, answerExplanation: null },
    ],
    ...overrides,
  }
}

function stem(overrides: Partial<GeneratedStem> = {}): GeneratedStem {
  return {
    stemText: 'Paragraph one.\n\nParagraph two.',
    categoryName: 'Reading Comprehension',
    difficultyTarget: 'medium',
    timeBurdenTarget: 'medium',
    warnings: [],
    questions: [mcQuestion(), mcQuestion(), mcQuestion(), mcQuestion()],
    ...overrides,
  }
}

describe('validateGeneratedStemCandidate', () => {
  it('accepts valid VR reading comprehension shape', () => {
    const issues = validateGeneratedStemCandidate(stem(), 0, {
      sectionName: 'Verbal Reasoning',
      categoryName: 'Reading Comprehension',
    })

    expect(issues.filter((issue) => issue.severity === 'blocking')).toEqual([])
  })

  it('blocks VR true false cannot tell option mismatches', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: "True, False, Can't Tell",
        questions: [mcQuestion(), mcQuestion(), mcQuestion(), mcQuestion()],
      }),
      0,
      {
        sectionName: 'Verbal Reasoning',
        categoryName: "True, False, Can't Tell",
      }
    )

    expect(issues.some((issue) => issue.code === 'vr_tfct_options' && issue.severity === 'blocking')).toBe(true)
  })

  it('blocks answer leakage in true false cannot tell statements', () => {
    const tfctOptions = [
      { answerText: 'True', isAnswer: true, answerExplanation: null },
      { answerText: 'False', isAnswer: false, answerExplanation: null },
      { answerText: "Can't Tell", isAnswer: false, answerExplanation: null },
    ]
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: "True, False, Can't Tell",
        questions: [
          mcQuestion({ questionText: 'This statement is **TRUE**.', options: tfctOptions }),
          mcQuestion({ options: tfctOptions }),
          mcQuestion({ options: tfctOptions }),
          mcQuestion({ options: tfctOptions }),
        ],
      }),
      0,
      {
        sectionName: 'Verbal Reasoning',
        categoryName: "True, False, Can't Tell",
      }
    )

    expect(issues.some((issue) => issue.code === 'vr_tfct_answer_leak')).toBe(true)
  })

  it('blocks QR questions without exactly five options', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Data Tables',
        questions: [mcQuestion()],
      }),
      0,
      {
        sectionName: 'Quantitative Reasoning',
        categoryName: 'Data Tables',
      }
    )

    expect(issues.some((issue) => issue.code === 'qr_option_count')).toBe(true)
  })

  it('requires the structured asset associated with a QR presentation category', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Graphs and Charts',
        questions: [mcQuestion({
          options: [
            { answerText: 'A', isAnswer: true, answerExplanation: null },
            { answerText: 'B', isAnswer: false, answerExplanation: null },
            { answerText: 'C', isAnswer: false, answerExplanation: null },
            { answerText: 'D', isAnswer: false, answerExplanation: null },
            { answerText: 'E', isAnswer: false, answerExplanation: null },
          ],
        })],
      }),
      0,
      {
        sectionName: 'Quantitative Reasoning',
        categoryName: 'Graphs and Charts',
      }
    )

    expect(issues.some((issue) => issue.code === 'qr_chart_required')).toBe(true)
  })

  it('accepts Venn diagrams in Decision Making answer options', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Venn Diagrams',
        questions: [
          mcQuestion({
            options: [
              {
                answerText: [{
                  type: 'visual',
                  visualType: 'set_diagram',
                  title: null,
                  altText: 'Option A set diagram.',
                  spec: {
                    shapes: [
                      { shape: 'ellipse', label: 'A', cx: 260, cy: 190, rx: 120, ry: 80 },
                      { shape: 'ellipse', label: 'B', cx: 360, cy: 190, rx: 120, ry: 80 },
                    ],
                    regionLabels: [
                      { text: 4, include: ['A'], exclude: ['B'] },
                      { text: 3, include: ['A', 'B'] },
                      { text: 5, include: ['B'], exclude: ['A'] },
                    ],
                  },
                }],
                isAnswer: true,
                answerExplanation: null,
              },
              { answerText: 'B', isAnswer: false, answerExplanation: null },
              { answerText: 'C', isAnswer: false, answerExplanation: null },
              { answerText: 'D', isAnswer: false, answerExplanation: null },
            ],
          }),
        ],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Venn Diagrams',
      }
    )

    expect(issues.some((issue) => issue.code === 'dm_venn_visual_required')).toBe(false)
    expect(issues.some((issue) => issue.code === 'dm_venn_shape_spec_required')).toBe(false)
    expect(issues.some((issue) => issue.code === 'dm_venn_numeric_regions_required')).toBe(false)
    expect(issues.some((issue) => issue.code === 'dm_venn_region_label_boundary_overlap')).toBe(false)
  })

  it('blocks Venn diagrams without numeric region labels', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Venn Diagrams',
        stemText: [{
          type: 'visual',
          visualType: 'set_diagram',
          title: 'Staff sets',
          altText: 'Set diagram with set labels only.',
          spec: {
            shapes: [
              { shape: 'ellipse', label: 'R', cx: 250, cy: 180, rx: 170, ry: 110 },
              { shape: 'circle', label: 'S', cx: 285, cy: 180, r: 55 },
              { shape: 'diamond', label: 'T', cx: 395, cy: 180, width: 210, height: 180 },
            ],
            labels: [
              { text: 'R', x: 155, y: 95 },
              { text: 'S', x: 280, y: 145 },
              { text: 'T', x: 455, y: 105 },
            ],
          },
        }],
        questions: [mcQuestion()],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Venn Diagrams',
      }
    )

    expect(issues.some((issue) => issue.code === 'dm_venn_numeric_regions_required')).toBe(true)
  })

  it('blocks Venn diagrams without a shape-to-set mapping', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Venn Diagrams',
        stemText: [{
          type: 'visual',
          visualType: 'set_diagram',
          title: 'Workshop attendance',
          altText: 'Unlabelled set diagram.',
          spec: {
            shapes: [
              { shape: 'triangle', x: 160, y: 80, width: 210, height: 220 },
              { shape: 'circle', cx: 335, cy: 125, r: 85 },
              { shape: 'diamond', cx: 430, cy: 220, width: 170, height: 170 },
            ],
            regionLabels: [
              { text: 6, x: 120, y: 105 },
              { text: 5, x: 315, y: 80 },
              { text: 4, x: 116, y: 305 },
            ],
          },
        }],
        questions: [mcQuestion()],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Venn Diagrams',
      }
    )

    expect(issues.some((issue) => issue.code === 'dm_venn_shape_mapping_required')).toBe(true)
  })

  it('accepts parseable Venn shape legends in region labels', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Venn Diagrams',
        stemText: [{
          type: 'visual',
          visualType: 'set_diagram',
          title: 'Cinema purchases',
          altText: 'Set diagram with parseable legend.',
          spec: {
            shapes: [
              { shape: 'triangle', x: 160, y: 80, width: 210, height: 220 },
              { shape: 'circle', cx: 300, cy: 150, r: 95 },
              { shape: 'pentagon', cx: 395, cy: 205, r: 105 },
            ],
            regionLabels: [
              { text: 'Triangle = Popcorn', x: 500, y: 112 },
              { text: 'Circle = Drink', x: 500, y: 151 },
              { text: 'Pentagon = Sweets', x: 500, y: 192 },
              { text: 14, include: ['Popcorn'], exclude: ['Drink', 'Sweets'] },
              { text: 9, include: ['Drink'], exclude: ['Popcorn', 'Sweets'] },
              { text: 7, include: ['Sweets'], exclude: ['Popcorn', 'Drink'] },
            ],
          },
        }],
        questions: [mcQuestion()],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Venn Diagrams',
      }
    )

    expect(issues.some((issue) => issue.code === 'dm_venn_shape_mapping_required')).toBe(false)
  })

  it('blocks duplicate semantic Venn region values', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Venn Diagrams',
        stemText: [{
          type: 'visual',
          visualType: 'set_diagram',
          title: 'Workshop attendance',
          altText: 'Set diagram with duplicate semantic regions.',
          spec: {
            shapes: [
              { id: 'A', shape: 'circle', label: 'Art', cx: 250, cy: 180, r: 100 },
              { id: 'B', shape: 'circle', label: 'Books', cx: 345, cy: 180, r: 100 },
            ],
            regionLabels: [
              { text: 6, include: ['A'], exclude: ['B'] },
              { text: 5, include: ['A'], exclude: ['B'] },
              { text: 4, include: ['A', 'B'] },
            ],
          },
        }],
        questions: [mcQuestion()],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Venn Diagrams',
      }
    )

    expect(issues.some((issue) => issue.code === 'dm_venn_duplicate_region_expression')).toBe(true)
  })

  it('blocks Venn numeric labels without semantic region expressions', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Venn Diagrams',
        stemText: [{
          type: 'visual',
          visualType: 'set_diagram',
          title: 'Activities',
          altText: 'Set diagram with coordinate-only regions.',
          spec: {
            shapes: [
              { shape: 'ellipse', label: 'A', cx: 260, cy: 190, rx: 120, ry: 80 },
              { shape: 'ellipse', label: 'B', cx: 360, cy: 190, rx: 120, ry: 80 },
            ],
            regionLabels: [
              { text: 4, x: 185, y: 190 },
              { text: 3, x: 310, y: 190 },
              { text: 5, x: 435, y: 190 },
            ],
          },
        }],
        questions: [mcQuestion()],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Venn Diagrams',
      }
    )

    expect(issues.some((issue) => issue.code === 'dm_venn_region_expression_required')).toBe(true)
  })

  it('blocks coordinate-only Venn labels instead of allowing ambiguous placement', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Venn Diagrams',
        stemText: [{
          type: 'visual',
          visualType: 'set_diagram',
          title: 'Activities',
          altText: 'Set diagram with an ambiguous boundary label.',
          spec: {
            shapes: [
              { shape: 'ellipse', label: 'A', cx: 260, cy: 190, rx: 120, ry: 80 },
              { shape: 'ellipse', label: 'B', cx: 360, cy: 190, rx: 120, ry: 80 },
            ],
            regionLabels: [
              { text: 4, x: 220, y: 190 },
              { text: 3, x: 380, y: 190 },
              { text: 5, x: 400, y: 190 },
            ],
          },
        }],
        questions: [mcQuestion()],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Venn Diagrams',
      }
    )

    expect(issues.some((issue) => issue.code === 'generated_visual_spec_invalid')).toBe(true)
    expect(issues.some((issue) => issue.code === 'dm_venn_region_expression_required')).toBe(true)
  })

  it('blocks legacy coloured Venn templates in Decision Making Venn diagrams', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Venn Diagrams',
        stemText: [{
          type: 'visual',
          visualType: 'venn_diagram',
          title: 'Activities',
          altText: 'Three overlapping circles.',
          spec: {
            shapes: [],
            regionLabels: [
              { text: 2, region: 'A only' },
              { text: 3, region: 'B only' },
              { text: 8, region: 'A & B & C' },
            ],
          },
        }],
        questions: [mcQuestion()],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Venn Diagrams',
      }
    )

    expect(issues.some((issue) => issue.code === 'dm_venn_shape_spec_required')).toBe(true)
  })

  it('accepts Vega-Lite timetable-style visuals for QR timetable categories', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Timetables and Calendars',
        stemText: [{
          type: 'visual',
          visualType: 'vega_lite_chart',
          title: 'Train times',
          altText: 'Rail timetable.',
          spec: {
            data: {
              values: [
                { station: 'Central', train: 'A', minutes: 490, time: '08:10' },
                { station: 'North', train: 'A', minutes: 502, time: '08:22' },
                { station: 'Airport', train: 'A', minutes: 530, time: '08:50' },
                { station: 'Central', train: 'B', minutes: 515, time: '08:35' },
                { station: 'North', train: 'B', minutes: 527, time: '08:47' },
                { station: 'Airport', train: 'B', minutes: 555, time: '09:15' },
              ],
            },
            mark: 'text',
            encoding: {
              x: { field: 'train', type: 'nominal', axis: { title: 'Train' } },
              y: { field: 'station', type: 'nominal', axis: { title: 'Station' } },
              text: { field: 'time' },
            },
          },
        }],
        questions: [mcQuestion({
          options: [
            { answerText: '20 min', isAnswer: true, answerExplanation: null },
            { answerText: '25 min', isAnswer: false, answerExplanation: null },
            { answerText: '30 min', isAnswer: false, answerExplanation: null },
            { answerText: '35 min', isAnswer: false, answerExplanation: null },
            { answerText: '40 min', isAnswer: false, answerExplanation: null },
          ],
        })],
      }),
      0,
      {
        sectionName: 'Quantitative Reasoning',
        categoryName: 'Timetables and Calendars',
      }
    )

    expect(issues.some((issue) => issue.code === 'qr_timetable_required')).toBe(false)
  })

  it('accepts Vega-Lite maps for QR maps and diagrams', () => {
    const vegaIssues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Maps and Diagrams',
        stemText: [{
          type: 'visual',
          visualType: 'vega_lite_chart',
          title: 'Park walking paths',
          altText: 'Layered route map with distances.',
          spec: {
            width: 520,
            height: 260,
            datasets: {
              points: [
                { id: 'gate', label: 'Gate', x: 0, y: 0 },
                { id: 'lake', label: 'Lake', x: 2, y: 1 },
                { id: 'hill', label: 'Hill', x: 5, y: 1.2 },
                { id: 'lookout', label: 'Lookout', x: 6, y: -0.8 },
              ],
              paths: [
                { x: 0, y: 0, order: 1, route: 'Gate-Lake', label: '360 m' },
                { x: 2, y: 1, order: 2, route: 'Gate-Lake', label: '360 m' },
                { x: 2, y: 1, order: 1, route: 'Lake-Hill', label: '420 m' },
                { x: 5, y: 1.2, order: 2, route: 'Lake-Hill', label: '420 m' },
                { x: 5, y: 1.2, order: 1, route: 'Hill-Lookout', label: '270 m' },
                { x: 6, y: -0.8, order: 2, route: 'Hill-Lookout', label: '270 m' },
              ],
              labels: [
                { text: '360 m', x: 1, y: 0.35 },
                { text: '420 m', x: 3.5, y: 1.28 },
                { text: '270 m', x: 5.6, y: 0.2 },
                { text: 'Park walking paths', x: 0, y: 1.75 },
              ],
            },
            layer: [
              {
                data: { name: 'paths' },
                mark: { type: 'line', stroke: '#111111', strokeWidth: 2 },
                encoding: {
                  x: { field: 'x', type: 'quantitative', axis: null },
                  y: { field: 'y', type: 'quantitative', axis: null },
                  detail: { field: 'route' },
                  order: { field: 'order' },
                },
              },
              {
                data: { name: 'points' },
                mark: { type: 'point', filled: true, size: 95, color: '#111111' },
                encoding: {
                  x: { field: 'x', type: 'quantitative', axis: null },
                  y: { field: 'y', type: 'quantitative', axis: null },
                },
              },
              {
                data: { name: 'points' },
                mark: { type: 'text', dy: 16, fontSize: 12 },
                encoding: {
                  x: { field: 'x', type: 'quantitative', axis: null },
                  y: { field: 'y', type: 'quantitative', axis: null },
                  text: { field: 'label' },
                },
              },
              {
                data: { name: 'labels' },
                mark: { type: 'text', fontSize: 12 },
                encoding: {
                  x: { field: 'x', type: 'quantitative', axis: null },
                  y: { field: 'y', type: 'quantitative', axis: null },
                  text: { field: 'text' },
                },
              },
            ],
          },
        }],
        questions: [mcQuestion({
          options: [
            { answerText: '1050 m', isAnswer: true, answerExplanation: null },
            { answerText: '720 m', isAnswer: false, answerExplanation: null },
            { answerText: '680 m', isAnswer: false, answerExplanation: null },
            { answerText: '620 m', isAnswer: false, answerExplanation: null },
            { answerText: '600 m', isAnswer: false, answerExplanation: null },
          ],
        })],
      }),
      0,
      {
        sectionName: 'Quantitative Reasoning',
        categoryName: 'Maps and Diagrams',
      }
    )

    expect(vegaIssues.some((issue) => issue.code === 'qr_map_required')).toBe(false)
  })

  it('warns for low-information QR Vega-Lite charts without axis context', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Graphs and Charts',
        stemText: [{
          type: 'visual',
          visualType: 'vega_lite_chart',
          title: 'Bookings',
          altText: 'Simple chart.',
          spec: {
            data: { values: [
              { day: 'Mon', bookings: 10 },
              { day: 'Tue', bookings: 12 },
              { day: 'Wed', bookings: 14 },
            ] },
            mark: 'bar',
            encoding: {
              x: { field: 'day', type: 'nominal' },
              y: { field: 'bookings', type: 'quantitative' },
            },
          },
        }],
        questions: [mcQuestion({
          options: [
            { answerText: '10', isAnswer: true, answerExplanation: null },
            { answerText: '11', isAnswer: false, answerExplanation: null },
            { answerText: '12', isAnswer: false, answerExplanation: null },
            { answerText: '13', isAnswer: false, answerExplanation: null },
            { answerText: '14', isAnswer: false, answerExplanation: null },
          ],
        })],
      }),
      0,
      {
        sectionName: 'Quantitative Reasoning',
        categoryName: 'Graphs and Charts',
      }
    )

    expect(issues.some((issue) => issue.code === 'qr_chart_low_information_density')).toBe(true)
    expect(issues.some((issue) => issue.code === 'qr_chart_axis_context_missing')).toBe(true)
  })

  it('blocks syllogisms without five explained statements', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Syllogisms',
        questions: [
          {
            ...mcQuestion(),
            questionText: "Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.",
            questionType: 'syllogism',
            answerExplanation: null,
            options: [
              { answerText: 'Conclusion 1', isAnswer: true, answerExplanation: 'Yes, because it follows.' },
              { answerText: 'Conclusion 2', isAnswer: false, answerExplanation: null },
            ],
          },
        ],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Syllogisms',
      }
    )

    expect(issues.some((issue) => issue.code === 'syllogism_option_count')).toBe(true)
    expect(issues.some((issue) => issue.code === 'missing_syllogism_option_explanation')).toBe(true)
  })

  it('blocks logical puzzles whose explanations admit unresolved ambiguity', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Logical Puzzles',
        questions: [
          mcQuestion({
            answerExplanation:
              'Both orders are possible, so there is no direct comparison between Emma and Kai. A is selected.',
          }),
        ],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Logical Puzzles',
      }
    )

    expect(
      issues.some(
        (issue) =>
          issue.code === 'dm_logical_puzzle_ambiguous_explanation' &&
          issue.severity === 'blocking'
      )
    ).toBe(true)
  })

  it('does not treat a name ending in i followed by must as self-reference', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Logical Puzzles',
        questions: [mcQuestion({
          answerExplanation:
            'Ali must be earlier than Bea. Therefore Ali takes the first slot, while each distractor violates that ordering rule.',
        })],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Logical Puzzles',
      }
    )

    expect(issues.some((issue) => issue.code === 'dm_logical_puzzle_ambiguous_explanation')).toBe(false)
  })

  it('blocks reversed duplicate pair options in logical puzzles', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        categoryName: 'Logical Puzzles',
        questions: [
          mcQuestion({
            options: [
              { answerText: 'Alice and Charles', isAnswer: true, answerExplanation: null },
              { answerText: 'Bob and Alice', isAnswer: false, answerExplanation: null },
              { answerText: 'Charles and Alice', isAnswer: false, answerExplanation: null },
              { answerText: 'Bob and Charles', isAnswer: false, answerExplanation: null },
            ],
          }),
        ],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Logical Puzzles',
      }
    )

    expect(issues.some((issue) => issue.code === 'dm_logical_duplicate_pair_option')).toBe(true)
  })

  it('blocks logical puzzles that repeat the question inside the stem', () => {
    const repeatedQuestion = 'Which one of the following MUST be true?'
    const issues = validateGeneratedStemCandidate(
      stem({
        stemText: `Four people are assigned different tasks. ${repeatedQuestion}`,
        categoryName: 'Logical Puzzles',
        questions: [mcQuestion({ questionText: repeatedQuestion })],
      }),
      0,
      {
        sectionName: 'Decision Making',
        categoryName: 'Logical Puzzles',
      }
    )

    expect(issues.some((issue) => issue.code === 'dm_logical_question_duplicated_in_stem')).toBe(true)
  })

  it('warns but does not block thin multiple-choice explanations', () => {
    const issues = validateGeneratedStemCandidate(
      stem({
        questions: [mcQuestion({ answerExplanation: 'A is right.' }), mcQuestion(), mcQuestion(), mcQuestion()],
      }),
      0,
      {
        sectionName: 'Verbal Reasoning',
        categoryName: 'Reading Comprehension',
      }
    )

    expect(issues.some((issue) => issue.code === 'thin_question_explanation' && issue.severity === 'warning')).toBe(true)
    expect(issues.some((issue) => issue.severity === 'blocking')).toBe(false)
  })
})
