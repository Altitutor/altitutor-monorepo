import {
  responseContractIssues,
  suggestedResponseContract,
  transformResponseContract,
} from '@/features/ucat/questions/lib/response-contract-authoring'
import { buildEmptyStemFormValues } from '@/features/ucat/questions/lib/stem-editor-form'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'

describe('UCAT response-contract authoring', () => {
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

  it('reports scheme-driven option and key incompatibilities', () => {
    const question = buildEmptyStemFormValues().questions[0]!
    question.responseType = 'drag_and_drop'
    question.answerScheme = 'decision_making_binary_placement'

    expect(responseContractIssues(question).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['wrong_option_count', 'missing_key_option']),
    )
  })
})
