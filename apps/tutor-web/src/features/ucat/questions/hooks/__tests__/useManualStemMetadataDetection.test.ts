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
        responseType: 'multiple_choice',
        answerScheme: 'single_choice',
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
  const multipleChoiceInference = {
    responseType: { value: 'multiple_choice' as const, confidence: 'certain' as const, evidence: ['single_answer_letter'], conflicts: [] },
    answerScheme: { value: 'single_choice' as const, confidence: 'certain' as const, evidence: ['single_choice_answer'], conflicts: [] },
    reviewState: 'prefilled' as const,
  }
  const binaryInference = {
    responseType: { value: 'drag_and_drop' as const, confidence: 'strong' as const, evidence: ['binary_conclusion_directive'], conflicts: [] },
    answerScheme: { value: 'decision_making_binary_placement' as const, confidence: 'strong' as const, evidence: ['binary_conclusion_directive'], conflicts: [] },
    reviewState: 'confirmation_required' as const,
  }

  it('returns null when recommendation matches current values', () => {
    const recommendation: ManualStemMetadataRecommendation = {
      sectionId: 'section-vr',
      categoryId: null,
      responseContractsByQuestionIndex: { 0: multipleChoiceInference },
      tagIdsByQuestionIndex: { 0: [] },
    }
    expect(getPendingStemMetadataDiff(recommendation, stemValues())).toBeNull()
  })

  it('includes only fields that differ from current values', () => {
    const recommendation: ManualStemMetadataRecommendation = {
      sectionId: 'section-dm',
      categoryId: 'cat-syll',
      responseContractsByQuestionIndex: { 0: binaryInference },
      tagIdsByQuestionIndex: { 0: ['tag-a', 'tag-b'] },
    }
    const diff = getPendingStemMetadataDiff(recommendation, stemValues())
    expect(diff).toEqual({
      sectionId: 'section-dm',
      categoryId: 'cat-syll',
      responseContractsByQuestionIndex: { 0: binaryInference },
      tagIdsByQuestionIndex: { 0: ['tag-a', 'tag-b'] },
    })
  })

  it('omits tags that already match', () => {
    const recommendation: ManualStemMetadataRecommendation = {
      sectionId: 'section-vr',
      categoryId: 'cat-tf',
      responseContractsByQuestionIndex: {},
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
            responseType: 'multiple_choice',
            answerScheme: 'single_choice',
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
      responseContractsByQuestionIndex: {},
      tagIdsByQuestionIndex: {},
    })
  })

  it('keeps absent response evidence visible for review even when defaults match', () => {
    const absentInference = {
      responseType: { value: null, confidence: 'absent' as const, evidence: [], conflicts: [] },
      answerScheme: { value: null, confidence: 'absent' as const, evidence: [], conflicts: [] },
      reviewState: 'review_required' as const,
    }
    const diff = getPendingStemMetadataDiff({
      sectionId: null,
      categoryId: null,
      responseContractsByQuestionIndex: { 0: absentInference },
      tagIdsByQuestionIndex: {},
    }, stemValues())

    expect(diff?.responseContractsByQuestionIndex[0]).toEqual(absentInference)
  })
})
