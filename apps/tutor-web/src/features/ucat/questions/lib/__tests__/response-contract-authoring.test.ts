import {
  questionsMatchSuggestedResponseContract,
  responseContractForType,
  responseContractIssues,
  shouldApplyCategoryDefaults,
  suggestedResponseContract,
  transformResponseContract,
} from '@/features/ucat/questions/lib/response-contract-authoring'
import { buildEmptyStemFormValues } from '@/features/ucat/questions/lib/stem-editor-form'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'

describe('UCAT response-contract authoring', () => {
  it('applies category defaults only to a new stem before its questions are edited', () => {
    expect(shouldApplyCategoryDefaults({
      stemId: null,
      previousCategoryId: null,
      questionsDirty: false,
    })).toBe(true)
    expect(shouldApplyCategoryDefaults({
      stemId: 'existing-stem',
      previousCategoryId: null,
      questionsDirty: false,
    })).toBe(false)
    expect(shouldApplyCategoryDefaults({
      stemId: null,
      previousCategoryId: 'existing-category',
      questionsDirty: false,
    })).toBe(false)
    expect(shouldApplyCategoryDefaults({
      stemId: null,
      previousCategoryId: null,
      questionsDirty: true,
    })).toBe(false)
  })

  it('suggests defaults from category without mutating authored content', () => {
    const question = buildEmptyStemFormValues().questions[0]!
    question.questionText = plainTextToProseMirror('Keep this question')
    const before = JSON.parse(JSON.stringify(question))

    expect(suggestedResponseContract(
      'Interpreting Information and Drawing Conclusions',
      'Decision Making',
    )).toEqual({
      responseType: 'drag_and_drop',
      answerScheme: 'decision_making_binary_placement',
    })
    expect(question).toEqual(before)
  })

  it('derives the Answer scheme when a tutor explicitly changes Response type', () => {
    expect(responseContractForType(
      'multiple_choice',
      'Syllogisms',
      'Decision Making',
    )).toEqual({ responseType: 'multiple_choice', answerScheme: 'single_choice' })

    expect(responseContractForType(
      'multiple_choice',
      'How Appropriate',
      'Situational Judgement',
    )).toEqual({
      responseType: 'multiple_choice',
      answerScheme: 'situational_judgement_rating',
    })

    expect(responseContractForType(
      'drag_and_drop',
      'Most/Least Appropriate',
      'Situational Judgement',
    )).toEqual({
      responseType: 'drag_and_drop',
      answerScheme: 'situational_judgement_most_least',
    })
  })

  it('only changes response data through the deliberate transform action', () => {
    const question = buildEmptyStemFormValues().questions[0]!
    question.questionText = plainTextToProseMirror('Keep this question')
    question.options[0]!.answerText = plainTextToProseMirror('Keep this option')

    const transformed = transformResponseContract(question, {
      responseType: 'drag_and_drop',
      answerScheme: 'decision_making_binary_placement',
    })

    expect(transformed.questionText).toEqual(question.questionText)
    expect(transformed.options[0]?.answerText).toEqual(question.options[0]?.answerText)
    expect(transformed).toMatchObject({
      responseType: 'drag_and_drop',
      answerScheme: 'decision_making_binary_placement',
    })
    expect(transformed.options).toHaveLength(5)
    expect(transformed.options.every((option) => option.answerKeyValue === 'yes' || option.answerKeyValue === 'no')).toBe(true)
    expect(responseContractIssues(transformed)).toEqual([])
  })

  it('blocks saving until every question matches the selected category contract', () => {
    const question = buildEmptyStemFormValues().questions[0]!
    const decisionMakingContract = suggestedResponseContract(
      'Syllogisms',
      'Decision Making',
    )

    expect(questionsMatchSuggestedResponseContract(
      [question],
      decisionMakingContract,
    )).toBe(false)

    expect(questionsMatchSuggestedResponseContract(
      [transformResponseContract(question, decisionMakingContract)],
      decisionMakingContract,
    )).toBe(true)
  })

  it('reports scheme-driven option and key incompatibilities', () => {
    const question = buildEmptyStemFormValues().questions[0]!
    question.responseType = 'drag_and_drop'
    question.answerScheme = 'decision_making_binary_placement'

    expect(responseContractIssues(question).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['wrong_option_count', 'missing_key_option']),
    )
  })
})
