import { optionsToStatements, statementsToOptions } from '@/features/ucat/shared/lib/syllogism'

describe('syllogism mapping', () => {
  it('maps statements to options and back', () => {
    const statements = [
      { text: 'Statement A', isYes: true },
      { text: 'Statement B', isYes: false },
    ]

    const options = statementsToOptions(statements)
    expect(options).toEqual([
      { answerText: 'Statement A', isAnswer: true },
      { answerText: 'Statement B', isAnswer: false },
    ])

    expect(optionsToStatements(options)).toEqual(statements)
  })
})
