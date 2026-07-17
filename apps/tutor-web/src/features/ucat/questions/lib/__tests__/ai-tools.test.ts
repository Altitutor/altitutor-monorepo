import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { plainTextToProseMirror, plainTextToProseMirrorWithLineBreaks } from '@/features/ucat/shared/lib/rich-text'
import {
  AiToolQuestionStemPayloadSchema,
  applyReviewFlagSuggestion,
  applyExplanationUpdates,
  findMissingExplanations,
  summarizeStemForAi,
  writtenQuestionToFormValue,
} from '../ai-tools'

function baseStem(questionType: 'multiple_choice' | 'syllogism'): UcatQuestionStemFormValues {
  return {
    sectionId: '00000000-0000-0000-0000-000000000001',
    categoryId: null,
    stemText: plainTextToProseMirror('Stem'),
    accessScope: 'public',
    questions: [
      {
        questionText: plainTextToProseMirror('Question'),
        questionType,
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: '',
        tagIds: [],
        options: Array.from({ length: questionType === 'syllogism' ? 5 : 4 }, (_, index) => ({
          answerText: plainTextToProseMirror(`Option ${index + 1}`),
          answerExplanation: null,
          isAnswer: index === 0,
        })),
      },
    ],
  }
}

describe('AI tools explanation helpers', () => {
  it('requires one question-level explanation for multiple-choice questions', () => {
    const stem = baseStem('multiple_choice')

    expect(findMissingExplanations(stem)).toEqual([
      { questionIndex: 0, questionNumber: 1, kind: 'question' },
    ])
  })

  it('defaults question visibility to public when omitted', () => {
    const stem = baseStem('multiple_choice')
    const parsed = AiToolQuestionStemPayloadSchema.parse({
      ...stem,
      accessScope: undefined,
    })

    expect(parsed.accessScope).toBe('public')
  })

  it('requires every syllogism option to have an explanation', () => {
    const stem = baseStem('syllogism')
    stem.questions[0]!.options[0]!.answerExplanation = plainTextToProseMirror('Explained')

    expect(findMissingExplanations(stem)).toEqual([
      { questionIndex: 0, questionNumber: 1, kind: 'option', optionIndex: 1 },
      { questionIndex: 0, questionNumber: 1, kind: 'option', optionIndex: 2 },
      { questionIndex: 0, questionNumber: 1, kind: 'option', optionIndex: 3 },
      { questionIndex: 0, questionNumber: 1, kind: 'option', optionIndex: 4 },
    ])
  })

  it('fills only empty explanations and preserves existing text', () => {
    const stem = baseStem('syllogism')
    stem.questions[0]!.options[0]!.answerExplanation = plainTextToProseMirror('Keep this')

    const result = applyExplanationUpdates(stem, [
      {
        questionIndex: 0,
        optionExplanations: ['Replace attempt', 'Generated B', 'Generated C', null, 'Generated E'],
        confidence: 0.9,
        unresolved: false,
        reviewRequired: false,
        rationale: 'test',
      },
    ])

    expect(result.appliedCount).toBe(3)
    expect(result.stem.questions[0]!.options[0]!.answerExplanation).toEqual(
      plainTextToProseMirror('Keep this')
    )
    expect(result.stem.questions[0]!.options[1]!.answerExplanation).toEqual(
      plainTextToProseMirror('Generated B')
    )
  })

  it('does not insert explanations for updates flagged for tutor review', () => {
    const stem = baseStem('multiple_choice')

    const result = applyExplanationUpdates(stem, [
      {
        questionIndex: 0,
        answerExplanation: 'Do not insert this',
        confidence: 0.9,
        unresolved: false,
        rationale: 'selected answer appears incorrect',
        reviewRequired: true,
        reviewMessage: 'Option B is more likely correct.',
        suggestedCorrectOptionIndex: 1,
        suggestedAnswerExplanation: 'B follows from the passage.',
        suggestedChanges: 'Change the selected answer to B.',
      },
    ])

    expect(result.appliedCount).toBe(0)
    expect(result.stem.questions[0]!.answerExplanation).toBeNull()
  })

  it('accepts a review flag suggestion by changing the selected answer and explanation', () => {
    const stem = baseStem('multiple_choice')

    const result = applyReviewFlagSuggestion(stem, {
      questionIndex: 0,
      message: 'Option B is correct.',
      suggestedCorrectOptionIndex: 1,
      suggestedAnswerExplanation: 'B is correct because it is directly supported.',
      suggestedChanges: 'Change answer to B.',
    })

    expect(result.questions[0]!.options.map((option) => option.isAnswer)).toEqual([false, true, false, false])
    expect(result.questions[0]!.answerExplanation).toEqual(
      plainTextToProseMirror('B is correct because it is directly supported.')
    )
  })

  it('summarizes selected correct options for the model', () => {
    const stem = baseStem('multiple_choice')

    expect(summarizeStemForAi(stem).questions[0]?.selectedCorrectOptions).toEqual([
      {
        optionIndex: 0,
        label: 'A',
        answerText: 'Option 1',
        isAnswer: true,
      },
    ])
  })

  it('summarizes stem paragraphs for passage evidence references', () => {
    const stem = baseStem('multiple_choice')
    stem.stemText = plainTextToProseMirrorWithLineBreaks('First paragraph.\n\nSecond paragraph.')

    expect(summarizeStemForAi(stem).stemParagraphs).toEqual([
      { paragraphNumber: 1, text: 'First paragraph.' },
      { paragraphNumber: 2, text: 'Second paragraph.' },
    ])
  })

  it('converts a written question response into form values', () => {
    const question = writtenQuestionToFormValue(
      {
        questionText: 'Which statement follows?',
        answerExplanation: 'Use the final sentence to eliminate the distractors.',
        options: [
          { answerText: 'A follows', isAnswer: true },
          { answerText: 'B follows', isAnswer: false },
        ],
        rationale: 'Tests inference.',
      },
      ['00000000-0000-0000-0000-000000000010']
    )

    expect(question.questionType).toBe('multiple_choice')
    expect(question.tagIds).toEqual(['00000000-0000-0000-0000-000000000010'])
    expect(question.options.map((option) => option.isAnswer)).toEqual([true, false])
    expect(question.answerExplanation).toEqual(
      plainTextToProseMirror('Use the final sentence to eliminate the distractors.')
    )
  })
})
