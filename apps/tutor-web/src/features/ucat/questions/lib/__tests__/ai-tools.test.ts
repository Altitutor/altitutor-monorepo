import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { plainTextToProseMirror, plainTextToProseMirrorWithLineBreaks, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
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

  it('keeps optional strategy and option-level explanations when they are useful', () => {
    const multipleChoice = applyExplanationUpdates(baseStem('multiple_choice'), [{
      questionIndex: 0,
      answerExplanation: 'Use the percentage-change formula.',
      optionExplanations: [null, 'This uses the final value as the denominator.', null, null],
      confidence: 0.9,
      unresolved: false,
      reviewRequired: false,
    }])
    expect(multipleChoice.appliedCount).toBe(2)
    expect(multipleChoice.stem.questions[0]!.answerExplanation).toEqual(
      plainTextToProseMirror('Use the percentage-change formula.')
    )
    expect(multipleChoice.stem.questions[0]!.options[1]!.answerExplanation).toEqual(
      plainTextToProseMirror('This uses the final value as the denominator.')
    )

    const syllogism = applyExplanationUpdates(baseStem('syllogism'), [{
      questionIndex: 0,
      answerExplanation: 'Sketch the premises as nested sets before checking each conclusion.',
      optionExplanations: ['A', 'B', 'C', 'D', 'E'],
      confidence: 0.9,
      unresolved: false,
      reviewRequired: false,
    }])
    expect(syllogism.appliedCount).toBe(6)
    expect(syllogism.stem.questions[0]!.answerExplanation).toEqual(
      plainTextToProseMirror('Sketch the premises as nested sets before checking each conclusion.')
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

  it('accepts a How Important option-scale suggested change', () => {
    const stem = baseStem('multiple_choice')

    const result = applyReviewFlagSuggestion(stem, {
      questionIndex: 0,
      message: 'Options use the wrong scale.',
      suggestedChanges:
        'Replace the options with the stated How Important scale: Very important; Important; Of minor importance; Not important at all.',
    })

    expect(
      result.questions[0]!.options.map((option) => proseMirrorToPlainText(option.answerText as never))
    ).toEqual([
      'Very important',
      'Important',
      'Of minor importance',
      'Not important at all',
    ])
  })

  it('accepts either/or wording fixes via an explicit choice', () => {
    const stem = baseStem('multiple_choice')
    stem.questions[0]!.questionText = plainTextToProseMirror(
      'Ask Dr Millar if she could spend less more time speaking to patients.'
    )

    const result = applyReviewFlagSuggestion(
      stem,
      {
        questionIndex: 0,
        message: 'Contradictory wording.',
        suggestedChanges:
          'Replace "less more time" with either "more time" or "less time" and re-key if necessary.',
      },
      { textReplacementTo: 'more time' }
    )

    expect(proseMirrorToPlainText(result.questions[0]!.questionText as never)).toContain(
      'spend more time speaking'
    )
    expect(proseMirrorToPlainText(result.questions[0]!.questionText as never)).not.toContain(
      'less more time'
    )
  })

  it('accepts How Appropriate scale suggestions that mention scale without listing options', () => {
    const stem = baseStem('multiple_choice')

    const result = applyReviewFlagSuggestion(stem, {
      questionIndex: 0,
      message: 'Wrong scale.',
      suggestedChanges: 'Switch the answer options to the How Appropriate scale.',
    })

    expect(
      result.questions[0]!.options.map((option) => proseMirrorToPlainText(option.answerText as never))
    ).toEqual([
      'A very appropriate thing to do',
      'Appropriate, but not ideal',
      'Inappropriate, but not awful',
      'A very inappropriate thing to do',
    ])
  })

  it('accepts letter-answer suggestions phrased as “correct answer should be”', () => {
    const stem = baseStem('multiple_choice')

    const result = applyReviewFlagSuggestion(stem, {
      questionIndex: 0,
      message: 'Wrong key.',
      suggestedChanges: 'The correct answer should be C.',
    })

    expect(result.questions[0]!.options.map((option) => option.isAnswer)).toEqual([
      false,
      false,
      true,
      false,
    ])
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
