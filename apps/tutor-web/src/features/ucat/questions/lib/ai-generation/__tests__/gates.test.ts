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
                    labels: [{ text: 'x', x: 310, y: 190 }],
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
            sets: [
              { id: 'A', label: 'Art' },
              { id: 'B', label: 'Books' },
              { id: 'C', label: 'Chess' },
            ],
            regions: { aOnly: 2, bOnly: 3, cOnly: 4, abOnly: 5, acOnly: 6, bcOnly: 7, abc: 8 },
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
