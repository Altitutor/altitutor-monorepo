import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  inferManualStemMetadataRecommendation,
  inferQuestionTagIdsForFormValues,
} from '../bulkImportMetadataInference'

function text(value: string) {
  return plainTextToProseMirror(value)
}

function stemValues(overrides: Partial<UcatQuestionStemFormValues> = {}): UcatQuestionStemFormValues {
  return {
    sectionId: 'vr-section',
    categoryId: null,
    stemText: text(''),
    accessScope: 'public',
    tutorSourceNote: '',
    questions: [
      {
        questionText: text(''),
        responseType: 'multiple_choice', answerScheme: 'single_choice',
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: '',
        tagIds: [],
        sourceChannel: 'individual',
        aiGenerationMetadata: null,
        options: [
          { answerText: text(''), answerExplanation: null, answerKeyValue: 'correct' },
          { answerText: text(''), answerExplanation: null, answerKeyValue: null },
        ],
      },
    ],
    ...overrides,
  }
}

const sections = [
  { id: 'vr-section', name: 'Verbal Reasoning' },
  { id: 'dm-section', name: 'Decision Making' },
  { id: 'qr-section', name: 'Quantitative Reasoning' },
  { id: 'sj-section', name: 'Situational Judgement' },
]

const categories = [
  { id: 'vr-reading', ucat_section_id: 'vr-section', name: 'Reading Comprehension' },
  { id: 'dm-syllogisms', ucat_section_id: 'dm-section', name: 'Syllogisms' },
  { id: 'qr-graphs', ucat_section_id: 'qr-section', name: 'Graphs and Charts' },
  { id: 'qr-text', ucat_section_id: 'qr-section', name: 'Text-Only Scenarios' },
  { id: 'sj-appropriate', ucat_section_id: 'sj-section', name: 'How Appropriate' },
]

describe('inferManualStemMetadataRecommendation', () => {
  it('does not recommend metadata for a blank create form', () => {
    const recommendation = inferManualStemMetadataRecommendation({
      values: stemValues(),
      sections,
      categories,
      tags: [],
    })

    expect(recommendation).toBeNull()
  })

  it('detects a distinctive category within the current section without switching', () => {
    const recommendation = inferManualStemMetadataRecommendation({
      values: stemValues({
        sectionId: 'qr-section',
        stemText: text('The line graph below shows clinic attendance over six months.'),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text('What was the percentage increase from January to March?'),
          },
        ],
      }),
      sections,
      categories,
      tags: [],
    })

    expect(recommendation?.sectionId).toBeNull()
    expect(recommendation?.categoryId).toBe('qr-graphs')
  })

  it('detects figure wording and embedded chart images for QR manual metadata', () => {
    const recommendation = inferManualStemMetadataRecommendation({
      values: stemValues({
        sectionId: 'qr-section',
        stemText: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'The figure below shows the changing market shares of three major UK supermarkets.',
                },
              ],
            },
            {
              type: 'paragraph',
              content: [{ type: 'image', attrs: { fileId: 'chart-1', src: 'https://example.com/chart.png' } }],
            },
          ],
        },
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text('Which supermarket had the highest market share in 2007?'),
          },
        ],
      }),
      sections,
      categories,
      tags: [],
    })

    expect(recommendation?.sectionId).toBeNull()
    expect(recommendation?.categoryId).toBe('qr-graphs')
  })

  it('does not switch away from Verbal Reasoning when the stem contains percentages', () => {
    const recommendation = inferManualStemMetadataRecommendation({
      values: stemValues({
        sectionId: 'vr-section',
        categoryId: 'vr-reading',
        stemText: text(
          'In Bellwater, 61% of surveyed members borrowed at least one item. Fees rose from $18 to higher rates.',
        ),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text('Which statement is best supported by the passage?'),
          },
        ],
      }),
      sections,
      categories,
      tags: [],
    })

    expect(recommendation?.sectionId).toBeNull()
    expect(recommendation?.categoryId).toBe('vr-reading')
  })

  it('recommends syllogism question type when already in Decision Making', () => {
    const recommendation = inferManualStemMetadataRecommendation({
      values: stemValues({
        sectionId: 'dm-section',
        stemText: text('All tutors are mentors. Some mentors are clinicians.'),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text("Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow."),
            options: [
              { answerText: text('Some tutors are clinicians.'), answerExplanation: null, answerKeyValue: null },
              { answerText: text('All clinicians are mentors.'), answerExplanation: null, answerKeyValue: null },
              { answerText: text('Some mentors are tutors.'), answerExplanation: null, answerKeyValue: 'correct' },
              { answerText: text('No tutors are clinicians.'), answerExplanation: null, answerKeyValue: null },
              { answerText: text('All mentors are tutors.'), answerExplanation: null, answerKeyValue: null },
            ],
          },
        ],
      }),
      sections,
      categories,
      tags: [],
    })

    expect(recommendation?.sectionId).toBeNull()
    expect(recommendation?.categoryId).toBe('dm-syllogisms')
    expect(recommendation?.responseContractsByQuestionIndex[0]).toMatchObject({
      responseType: { value: 'drag_and_drop', confidence: 'strong' },
      answerScheme: { value: 'decision_making_binary_placement', confidence: 'strong' },
      reviewState: 'confirmation_required',
    })
  })

  it('can still detect a section when none is currently set', () => {
    const recommendation = inferManualStemMetadataRecommendation({
      values: stemValues({
        sectionId: '',
        stemText: text('The line graph below shows clinic attendance over six months.'),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text('What was the percentage increase from January to March?'),
          },
        ],
      }),
      sections,
      categories,
      tags: [],
    })

    expect(recommendation?.sectionId).toBe('qr-section')
    expect(recommendation?.categoryId).toBe('qr-graphs')
  })

  it('does not switch section from broad fallback categories', () => {
    const recommendation = inferManualStemMetadataRecommendation({
      values: stemValues({
        stemText: text('A short passage describes a situation without a distinctive visual source.'),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text('Which option is best supported by the passage?'),
          },
        ],
      }),
      sections,
      categories,
      tags: [],
    })

    expect(recommendation?.sectionId).toBeNull()
    expect(recommendation?.categoryId).toBe('vr-reading')
  })

  it('reuses QR taxonomy paths to recommend question tags', () => {
    const recommendation = inferManualStemMetadataRecommendation({
      values: stemValues({
        sectionId: 'qr-section',
        stemText: text('The table shows the original and final prices of several items.'),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text('Which item had the greatest percentage increase?'),
          },
        ],
      }),
      sections,
      categories,
      tags: [
        { id: 'percentages', name: 'Percentages', parent_question_tag_id: null, ucat_section_id: 'qr-section' },
        { id: 'percentage-increase', name: 'Percentage increase', parent_question_tag_id: 'percentages', ucat_section_id: null },
      ],
    })

    expect(recommendation?.tagIdsByQuestionIndex[0]).toEqual(['percentage-increase'])
  })

  it('reuses VR taxonomy paths to recommend question tags', () => {
    const recommendation = inferManualStemMetadataRecommendation({
      values: stemValues({
        sectionId: 'vr-section',
        stemText: text('Paragraph 1 describes the Marsden study. Paragraph 2 gives the later criticism.'),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text('Which statement is best supported across paragraphs 1 and 2?'),
          },
        ],
      }),
      sections,
      categories,
      tags: [
        { id: 'evidence-handling', name: 'Evidence handling', parent_question_tag_id: null, ucat_section_id: 'vr-section' },
        { id: 'cross-paragraph-evidence', name: 'Cross-paragraph evidence', parent_question_tag_id: 'evidence-handling', ucat_section_id: null },
        { id: 'author-meaning', name: 'Author and passage meaning', parent_question_tag_id: null, ucat_section_id: 'vr-section' },
        { id: 'argument-support', name: 'Argument support', parent_question_tag_id: 'author-meaning', ucat_section_id: null },
      ],
    })

    expect(recommendation?.tagIdsByQuestionIndex[0]).toEqual([
      'cross-paragraph-evidence',
      'argument-support',
    ])
  })
})

describe('inferQuestionTagIdsForFormValues', () => {
  it('infers tags directly from generated/imported form values', () => {
    const tagIds = inferQuestionTagIdsForFormValues({
      values: stemValues({
        sectionId: 'qr-section',
        stemText: text('The table shows the original and final prices of several items.'),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text('Which item had the greatest percentage increase?'),
          },
        ],
      }),
      sectionId: 'qr-section',
      sectionName: 'Quantitative Reasoning',
      tags: [
        { id: 'percentages', name: 'Percentages', parent_question_tag_id: null, ucat_section_id: 'qr-section' },
        { id: 'percentage-increase', name: 'Percentage increase', parent_question_tag_id: 'percentages', ucat_section_id: null },
      ],
    })

    expect(tagIds[0]).toEqual(['percentage-increase'])
  })

  it('accepts an already-normalized section key', () => {
    const tagIds = inferQuestionTagIdsForFormValues({
      values: stemValues({
        sectionId: 'qr-section',
        stemText: text('A chart shows the original and final prices of several items.'),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text('Which item had the greatest percentage increase?'),
          },
        ],
      }),
      sectionId: 'qr-section',
      section: 'quantitative_reasoning',
      tags: [
        { id: 'percentages', name: 'Percentages', parent_question_tag_id: null, ucat_section_id: 'qr-section' },
        { id: 'percentage-increase', name: 'Percentage increase', parent_question_tag_id: 'percentages', ucat_section_id: null },
      ],
    })

    expect(tagIds[0]).toEqual(['percentage-increase'])
  })

  it('infers VR tags directly from generated/imported form values', () => {
    const tagIds = inferQuestionTagIdsForFormValues({
      values: stemValues({
        sectionId: 'vr-section',
        stemText: text('The passage argues that the trial was limited by its small sample size.'),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text("If new evidence showed the sample was representative, which option would most weaken the author's argument?"),
          },
        ],
      }),
      sectionId: 'vr-section',
      sectionName: 'Verbal Reasoning',
      tags: [
        { id: 'application', name: 'Application', parent_question_tag_id: null, ucat_section_id: 'vr-section' },
        { id: 'new-information', name: 'New information', parent_question_tag_id: 'application', ucat_section_id: null },
        { id: 'hypothetical-application', name: 'Hypothetical application', parent_question_tag_id: 'application', ucat_section_id: null },
      ],
    })

    expect(tagIds[0]).toEqual(['new-information', 'hypothetical-application'])
  })

  it('infers DM tags directly from generated/imported form values', () => {
    const tagIds = inferQuestionTagIdsForFormValues({
      values: stemValues({
        sectionId: 'dm-section',
        stemText: text('A bag contains five red balls and three blue balls. Two balls are selected without replacement.'),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text('What is the probability that selecting two red balls is greater than selecting two blue balls?'),
          },
        ],
      }),
      sectionId: 'dm-section',
      sectionName: 'Decision Making',
      tags: [
        { id: 'prob-root', name: 'Probability and data reasoning', parent_question_tag_id: null, ucat_section_id: 'dm-section' },
        { id: 'basic-probability', name: 'Basic probability', parent_question_tag_id: 'prob-root', ucat_section_id: null },
        { id: 'without-replacement', name: 'Without replacement / combinations', parent_question_tag_id: 'prob-root', ucat_section_id: null },
        { id: 'fraction-comparison', name: 'Fraction / percentage comparison', parent_question_tag_id: 'prob-root', ucat_section_id: null },
        { id: 'trap-root', name: 'Decision wording traps', parent_question_tag_id: null, ucat_section_id: 'dm-section' },
        { id: 'greater-less', name: 'Greater than / less than comparison', parent_question_tag_id: 'trap-root', ucat_section_id: null },
      ],
    })

    expect(tagIds[0]).toEqual([
      'basic-probability',
      'without-replacement',
      'fraction-comparison',
      'greater-less',
    ])
  })

  it('infers SJ practical and ethics tags directly from generated/imported form values', () => {
    const tagIds = inferQuestionTagIdsForFormValues({
      values: stemValues({
        sectionId: 'sj-section',
        stemText: text('Arran becomes ill with tonsillitis before surgery. His illness could put the patient in the surgery at risk.'),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text('His illness could put the patient in the surgery at risk.'),
          },
        ],
      }),
      sectionId: 'sj-section',
      sectionName: 'Situational Judgement',
      tags: [
        { id: 'patient-safety-root', name: 'Patient welfare and safety', parent_question_tag_id: null, ucat_section_id: 'sj-section' },
        { id: 'patient-safety', name: 'Patient safety', parent_question_tag_id: 'patient-safety-root', ucat_section_id: null },
        { id: 'infection-risk', name: 'Infection risk', parent_question_tag_id: 'patient-safety-root', ucat_section_id: null },
        { id: 'ethics-root', name: 'Ethical principles', parent_question_tag_id: null, ucat_section_id: 'sj-section' },
        { id: 'non-maleficence', name: 'Non-maleficence', parent_question_tag_id: 'ethics-root', ucat_section_id: null },
      ],
    })

    expect(tagIds[0]).toEqual(['patient-safety', 'infection-risk', 'non-maleficence'])
  })
})
