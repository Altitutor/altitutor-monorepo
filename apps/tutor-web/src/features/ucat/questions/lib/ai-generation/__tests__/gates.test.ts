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
