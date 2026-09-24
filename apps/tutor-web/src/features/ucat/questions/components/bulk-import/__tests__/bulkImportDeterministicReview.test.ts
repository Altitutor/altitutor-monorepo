import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { runBulkImportDeterministicReview } from '../bulkImportDeterministicReview'

function doc(text: string): Json {
  return {
    type: 'doc',
    content: text.split('\n\n').map((paragraph) => ({
      type: 'paragraph',
      content: paragraph ? [{ type: 'text', text: paragraph }] : [],
    })),
  }
}

function options(
  labels: string[],
  correctIndex = 0,
  explanations = false,
): UcatQuestionStemFormValues['questions'][number]['options'] {
  return labels.map((label, index) => ({
    answerText: doc(label),
    answerExplanation: explanations ? doc(`Explanation for ${label}.`) : null,
    answerKeyValue: index === correctIndex ? 'correct' : null,
  }))
}

function question(
  overrides: Partial<UcatQuestionStemFormValues['questions'][number]> = {},
): UcatQuestionStemFormValues['questions'][number] {
  return {
    questionText: doc('Which answer is correct?'),
    responseType: 'multiple_choice', answerScheme: 'single_choice',
    answerExplanation: doc('A complete teaching explanation.'),
    difficulty: null,
    timeBurdenSeconds: '',
    tagIds: [],
    options: options(['A', 'B', 'C', 'D']),
    ...overrides,
  }
}

function stem(
  questions: UcatQuestionStemFormValues['questions'],
  stemText = 'First paragraph.\n\nSecond paragraph.',
): UcatQuestionStemFormValues {
  return {
    sectionId: '11111111-1111-4111-8111-111111111111',
    categoryId: '22222222-2222-4222-8222-222222222222',
    stemText: doc(stemText),
    accessScope: 'public',
    questions,
  }
}

describe('runBulkImportDeterministicReview', () => {
  it('accepts valid VR Reading Comprehension and leaves the input untouched', () => {
    const input = stem(Array.from({ length: 4 }, () => question()))
    const result = runBulkImportDeterministicReview({
      values: input,
      sectionName: 'Verbal Reasoning',
      categoryName: 'Reading Comprehension',
    })

    expect(result.issues).toEqual([])
    expect(result.fixes).toEqual([])
    expect(result.values).not.toBe(input)
    expect(result.hasHardFailures).toBe(false)
  })

  it('accepts VR stems with more than four questions', () => {
    const result = runBulkImportDeterministicReview({
      values: stem(Array.from({ length: 5 }, () => question())),
      sectionName: 'Verbal Reasoning',
      categoryName: 'Reading Comprehension',
    })

    expect(result.issues.map((issue) => issue.code)).not.toContain('vr_question_count')
    expect(result.hasHardFailures).toBe(false)
  })

  it('removes only anchored synthetic VR passage labels', () => {
    const input = stem(
      Array.from({ length: 4 }, () => question()),
      'Stem 1: A flower stem carries water.\n\nParagraph 2. It also supports the flower.',
    )
    const result = runBulkImportDeterministicReview({
      values: input,
      sectionName: 'Verbal Reasoning',
      categoryName: 'Reading Comprehension',
    })

    expect(proseMirrorToPlainText(result.values.stemText)).toBe(
      'A flower stem carries water.\nIt also supports the flower.',
    )
    expect(result.fixes).toContainEqual(expect.objectContaining({ code: 'vr_passage_labels' }))
    expect(result.issues).toEqual([])
  })

  it('normalises and reorders TFCT options without losing their keyed answer', () => {
    const tfct = () =>
      question({
        options: options(["can't tell", 'TRUE', 'False'], 1),
      })
    const result = runBulkImportDeterministicReview({
      values: stem([tfct(), tfct(), tfct(), tfct()]),
      sectionName: 'Verbal Reasoning',
      categoryName: "True, False, Can't Tell",
    })

    expect(
      result.values.questions[0]?.options.map((option) => proseMirrorToPlainText(option.answerText)),
    ).toEqual(['True', 'False', "Can't Tell"])
    expect(result.values.questions[0]?.options.map((option) => option.answerKeyValue)).toEqual([
      'correct',
      null,
      null,
    ])
    expect(result.issues).toEqual([])
    expect(result.fixes.filter((fix) => fix.code === 'vr_tfct_options')).toHaveLength(4)
  })

  it('keeps unsafe VR shape problems as scoped hard failures', () => {
    const result = runBulkImportDeterministicReview({
      values: stem([
        question({ options: options(['True', 'False']) }),
        question(),
        question(),
      ], 'Only one paragraph.'),
      sectionName: 'Verbal Reasoning',
      categoryName: "True, False, Can't Tell",
    })

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'vr_question_count', scope: { type: 'stem' } }),
      expect.objectContaining({ code: 'vr_paragraph_count', scope: { type: 'stem' } }),
      expect.objectContaining({
        code: 'vr_tfct_options',
        scope: { type: 'question', questionIndex: 0 },
      }),
    ]))
    expect(result.hasHardFailures).toBe(true)
  })

  it('does not derive a response contract from the Decision Making category', () => {
    const result = runBulkImportDeterministicReview({
      values: stem([
        question({
          questionText: doc('Decide whether each follows.'),
          responseType: 'multiple_choice',
          answerScheme: 'single_choice',
          answerExplanation: null,
          options: options(['One', 'Two', 'Three', 'Four']),
        }),
      ]),
      sectionName: 'Decision Making',
      categoryName: 'Syllogisms',
    })

    expect(result.values.questions[0]).toMatchObject({
      responseType: 'multiple_choice',
      answerScheme: 'single_choice',
    })
    expect(proseMirrorToPlainText(result.values.questions[0]?.questionText)).toBe(
      'Decide whether each follows.',
    )
    expect(result.fixes).toEqual([])
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'missing_question_explanation' }))
  })

  it('blocks Decision Making stems that contain more than one question', () => {
    const result = runBulkImportDeterministicReview({
      values: stem([question(), question()]),
      sectionName: 'Decision Making',
      categoryName: 'Logical Puzzles',
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'dm_question_count',
      scope: { type: 'stem' },
    }))
    expect(result.hasHardFailures).toBe(true)
  })

  it('repairs the Recognising Assumptions instruction but does not invent missing arguments', () => {
    const result = runBulkImportDeterministicReview({
      values: stem([question({ questionText: doc('Pick one.'), options: options(['A', 'B', 'C']) })]),
      sectionName: 'Decision Making',
      categoryName: 'Recognising Assumptions',
    })

    expect(proseMirrorToPlainText(result.values.questions[0]?.questionText)).toBe(
      'Select the strongest argument from the statements below.',
    )
    expect(result.fixes).toContainEqual(expect.objectContaining({ code: 'dm_assumption_instruction' }))
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'dm_assumption_option_count',
      scope: { type: 'question', questionIndex: 0 },
    }))
  })

  it('requires exactly five options on every QR question', () => {
    const result = runBulkImportDeterministicReview({
      values: stem([question({ options: options(['A', 'B', 'C', 'D']) }), question({
        options: options(['A', 'B', 'C', 'D', 'E']),
      })]),
      sectionName: 'Quantitative Reasoning',
      categoryName: 'Graphs and Charts',
    })

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'qr_option_count',
        scope: { type: 'question', questionIndex: 0 },
      }),
    ])
  })

  it('normalises SJ options and reports mixed or unrecognisable modes as hard failures', () => {
    const important = question({
      options: options([
        'Important',
        'Very important',
        'Not important at all',
        'Of minor importance',
      ], 1),
    })
    const appropriate = question({
      options: options([
        'A very appropriate thing to do',
        'Appropriate, but not ideal',
        'Inappropriate, but not awful',
        'A very inappropriate thing to do',
      ]),
    })
    const result = runBulkImportDeterministicReview({
      values: stem([important, appropriate]),
      sectionName: 'Situational Judgement',
      categoryName: 'How Important',
    })

    expect(
      result.values.questions[0]?.options.map((option) => proseMirrorToPlainText(option.answerText)),
    ).toEqual(['Very important', 'Important', 'Of minor importance', 'Not important at all'])
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'sjt_options', scope: { type: 'question', questionIndex: 1 } }),
    ]))
  })

  it('enforces explanation completeness according to question type', () => {
    const mc = question({ answerExplanation: null })
    const syllogism = question({
      responseType: 'drag_and_drop', answerScheme: 'decision_making_binary_placement',
      answerExplanation: doc('Optional overall strategy.'),
      options: options(['One', 'Two', 'Three', 'Four', 'Five'], 0, true),
    })
    syllogism.options[3]!.answerExplanation = null

    const mcResult = runBulkImportDeterministicReview({
      values: stem([mc]),
      sectionName: 'Quantitative Reasoning',
      categoryName: 'Text-only',
    })
    const syllogismResult = runBulkImportDeterministicReview({
      values: stem([syllogism]),
      sectionName: 'Decision Making',
      categoryName: 'Syllogisms',
    })

    expect(mcResult.issues).toContainEqual(expect.objectContaining({
      code: 'missing_question_explanation',
    }))
    expect(syllogismResult.issues).toContainEqual(expect.objectContaining({
      code: 'missing_placement_option_explanation',
      scope: { type: 'option', questionIndex: 0, optionIndex: 3 },
    }))
    expect(syllogismResult.issues.some((issue) => issue.code === 'missing_question_explanation')).toBe(false)
  })

  it('accepts Interpreting Information as either response contract', () => {
    const placement = question({
      questionText: doc("Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow."),
      responseType: 'drag_and_drop',
      answerScheme: 'decision_making_binary_placement',
      answerExplanation: null,
      options: options(['One', 'Two', 'Three', 'Four', 'Five'], 0, true).map((option, index) => ({
        ...option,
        answerKeyValue: index % 2 === 0 ? 'yes' as const : 'no' as const,
      })),
    })
    const multipleChoice = runBulkImportDeterministicReview({
      values: stem([question()]),
      sectionName: 'Decision Making',
      categoryName: 'Interpreting Information and Drawing Conclusions',
    })
    const placementResult = runBulkImportDeterministicReview({
      values: stem([placement]),
      sectionName: 'Decision Making',
      categoryName: 'Interpreting Information and Drawing Conclusions',
    })

    expect(multipleChoice.issues.map((issue) => issue.code)).not.toEqual(expect.arrayContaining([
      'dm_category',
      'dm_response_type',
    ]))
    expect(placementResult.issues.map((issue) => issue.code)).not.toEqual(expect.arrayContaining([
      'dm_category',
      'dm_response_type',
    ]))
  })

  it('accepts Most/Least Appropriate without forcing a rating response', () => {
    const result = runBulkImportDeterministicReview({
      values: stem([question({
        questionText: doc('Place the most and least appropriate actions.'),
        responseType: 'drag_and_drop',
        answerScheme: 'situational_judgement_most_least',
        options: [
          { answerText: doc('Reassure the patient'), answerExplanation: null, answerKeyValue: 'most' },
          { answerText: doc('Escalate immediately'), answerExplanation: null, answerKeyValue: 'least' },
          { answerText: doc('Ignore the concern'), answerExplanation: null, answerKeyValue: null },
        ],
      })]),
      sectionName: 'Situational Judgement',
      categoryName: 'Most/Least Appropriate',
    })

    expect(result.issues.map((issue) => issue.code)).not.toEqual(expect.arrayContaining([
      'sjt_category',
      'sj_response_type',
    ]))
  })
})
