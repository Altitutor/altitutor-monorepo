import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import { applyExplanationUpdates, findMissingExplanations } from '../ai-tools'

function baseStem(questionType: 'multiple_choice' | 'syllogism'): UcatQuestionStemFormValues {
  return {
    sectionId: '00000000-0000-0000-0000-000000000001',
    categoryId: null,
    stemText: plainTextToProseMirror('Stem'),
    isPrivate: true,
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
})
