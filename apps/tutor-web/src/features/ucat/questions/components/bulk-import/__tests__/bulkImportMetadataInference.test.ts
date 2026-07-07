import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { inferManualStemMetadataRecommendation } from '../bulkImportMetadataInference'

function text(value: string) {
  return plainTextToProseMirror(value)
}

function stemValues(overrides: Partial<UcatQuestionStemFormValues> = {}): UcatQuestionStemFormValues {
  return {
    sectionId: 'vr-section',
    categoryId: null,
    stemText: text(''),
    isPrivate: false,
    tutorSourceNote: '',
    questions: [
      {
        questionText: text(''),
        questionType: 'multiple_choice',
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: '',
        tagIds: [],
        sourceChannel: 'individual',
        aiGenerationMetadata: null,
        options: [
          { answerText: text(''), answerExplanation: null, isAnswer: true },
          { answerText: text(''), answerExplanation: null, isAnswer: false },
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

  it('detects a distinctive category and recommends the linked section', () => {
    const recommendation = inferManualStemMetadataRecommendation({
      values: stemValues({
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

  it('recommends syllogism question type when the Syllogisms category is detected', () => {
    const recommendation = inferManualStemMetadataRecommendation({
      values: stemValues({
        stemText: text('All tutors are mentors. Some mentors are clinicians.'),
        questions: [
          {
            ...stemValues().questions[0]!,
            questionText: text("Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow."),
            options: [
              { answerText: text('Some tutors are clinicians.'), answerExplanation: null, isAnswer: false },
              { answerText: text('All clinicians are mentors.'), answerExplanation: null, isAnswer: false },
              { answerText: text('Some mentors are tutors.'), answerExplanation: null, isAnswer: true },
              { answerText: text('No tutors are clinicians.'), answerExplanation: null, isAnswer: false },
              { answerText: text('All mentors are tutors.'), answerExplanation: null, isAnswer: false },
            ],
          },
        ],
      }),
      sections,
      categories,
      tags: [],
    })

    expect(recommendation?.sectionId).toBe('dm-section')
    expect(recommendation?.categoryId).toBe('dm-syllogisms')
    expect(recommendation?.questionType).toBe('syllogism')
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
})
