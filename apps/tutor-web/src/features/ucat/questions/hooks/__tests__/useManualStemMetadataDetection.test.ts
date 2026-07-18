import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { ManualStemMetadataRecommendation } from '@/features/ucat/questions/components/bulk-import/bulkImportMetadataInference'
import { getPendingStemMetadataDiff } from '../useManualStemMetadataDetection'

function text(value: string) {
  return plainTextToProseMirror(value)
}

function stemValues(overrides: Partial<UcatQuestionStemFormValues> = {}): UcatQuestionStemFormValues {
  return {
    sectionId: 'section-vr',
    categoryId: null,
    stemText: text(''),
    accessScope: 'public',
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
        ],
      },
    ],
    ...overrides,
  }
}

describe('getPendingStemMetadataDiff', () => {
  it('returns null when recommendation matches current values', () => {
    const recommendation: ManualStemMetadataRecommendation = {
      sectionId: 'section-vr',
      categoryId: null,
      questionType: 'multiple_choice',
      tagIdsByQuestionIndex: { 0: [] },
    }
    expect(getPendingStemMetadataDiff(recommendation, stemValues())).toBeNull()
  })

  it('includes only fields that differ from current values', () => {
    const recommendation: ManualStemMetadataRecommendation = {
      sectionId: 'section-dm',
      categoryId: 'cat-syll',
      questionType: 'syllogism',
      tagIdsByQuestionIndex: { 0: ['tag-a', 'tag-b'] },
    }
    const diff = getPendingStemMetadataDiff(recommendation, stemValues())
    expect(diff).toEqual({
      sectionId: 'section-dm',
      categoryId: 'cat-syll',
      questionType: 'syllogism',
      tagIdsByQuestionIndex: { 0: ['tag-a', 'tag-b'] },
    })
  })

  it('omits tags that already match', () => {
    const recommendation: ManualStemMetadataRecommendation = {
      sectionId: 'section-vr',
      categoryId: 'cat-tf',
      questionType: null,
      tagIdsByQuestionIndex: { 0: ['tag-a'] },
    }
    const diff = getPendingStemMetadataDiff(
      recommendation,
      stemValues({
        categoryId: null,
        questions: [
          {
            questionText: text(''),
            questionType: 'multiple_choice',
            answerExplanation: null,
            difficulty: null,
            timeBurdenSeconds: '',
            tagIds: ['tag-a'],
            sourceChannel: 'individual',
            aiGenerationMetadata: null,
            options: [
              { answerText: text(''), answerExplanation: null, isAnswer: true },
            ],
          },
        ],
      }),
    )
    expect(diff).toEqual({
      sectionId: null,
      categoryId: 'cat-tf',
      questionType: null,
      tagIdsByQuestionIndex: {},
    })
  })
})
