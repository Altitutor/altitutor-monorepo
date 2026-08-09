import {
  applyPlacementTransition,
  compileResponseContract,
  createResponseState,
  evaluateResponse,
  getAnswerSchemeMaximum,
  getAnswerSchemeProgressPoints,
  getAnswerSchemeContract,
  getAnswerSchemePresentation,
} from '../index'

describe('UCAT response contract', () => {
  it('exposes authoring constraints from the same scheme registry', () => {
    expect(getAnswerSchemeContract('single_choice')).toEqual({
      responseType: 'multiple_choice',
      optionCount: { minimum: 2 },
    })
    expect(getAnswerSchemeContract('decision_making_binary_placement')).toEqual({
      responseType: 'drag_and_drop',
      optionCount: 5,
    })
    expect(getAnswerSchemeMaximum('single_choice')).toBe(1)
    expect(getAnswerSchemeMaximum('decision_making_binary_placement')).toBe(2)
    expect(getAnswerSchemeMaximum('situational_judgement_most_least')).toBe(8)
    expect(getAnswerSchemeProgressPoints('single_choice')).toBe(1)
    expect(getAnswerSchemeProgressPoints('decision_making_binary_placement')).toBe(2)
    expect(getAnswerSchemeProgressPoints('situational_judgement_most_least')).toBe(1)
  })

  it('owns once-only placement transitions for every UI surface', () => {
    const presentation = getAnswerSchemePresentation(
      'situational_judgement_most_least',
      ['a', 'b', 'c']
    )
    if (presentation.kind !== 'placement') {
      throw new Error('Expected a placement presentation')
    }

    expect(applyPlacementTransition({
      presentation,
      placements: { a: 'most', c: 'least' },
      targetId: 'b',
      token: 'most',
      sourceId: null,
    })).toEqual({ b: 'most', c: 'least' })
  })

  it('supports a complete single-choice response through one public contract', () => {
    const compiled = compileResponseContract({
      questionId: 'question-1',
      responseType: 'multiple_choice',
      answerScheme: {
        kind: 'single_choice',
        correctOptionId: 'option-b',
      },
      options: [
        { id: 'option-a', index: 0 },
        { id: 'option-b', index: 1 },
        { id: 'option-c', index: 2 },
      ],
    })

    expect(compiled).toEqual({
      ok: true,
      contract: expect.objectContaining({
        questionId: 'question-1',
        responseType: 'multiple_choice',
        answerSchemeKind: 'single_choice',
        presentation: {
          kind: 'single_select',
          optionIds: ['option-a', 'option-b', 'option-c'],
        },
      }),
    })

    if (!compiled.ok) throw new Error('Expected a valid contract')

    const blank = createResponseState(compiled.contract)
    expect(blank).toEqual({
      ok: true,
      state: {
        kind: 'single_select',
        selectedOptionId: null,
      },
    })

    const result = evaluateResponse(compiled.contract, {
      kind: 'single_select',
      selectedOptionId: 'option-b',
    })

    expect(result).toEqual({
      ok: true,
      response: {
        kind: 'single_select',
        selectedOptionId: 'option-b',
      },
      complete: true,
      snapshot: {
        type: 'ucat_response_v1',
        questionId: 'question-1',
        answerScheme: 'single_choice',
        response: {
          kind: 'single_select',
          selectedOptionId: 'option-b',
        },
      },
      score: { awarded: 1, maximum: 1 },
      review: {
        kind: 'single_select',
        selectedOptionId: 'option-b',
        correctOptionId: 'option-b',
        outcome: 'correct',
      },
    })
  })

  it('scores Decision Making binary placements as one five-conclusion item', () => {
    const compiled = compileResponseContract({
      questionId: 'dm-question',
      responseType: 'drag_and_drop',
      answerScheme: {
        kind: 'decision_making_binary_placement',
        correctByOptionId: {
          'conclusion-1': 'yes',
          'conclusion-2': 'no',
          'conclusion-3': 'yes',
          'conclusion-4': 'no',
          'conclusion-5': 'yes',
        },
      },
      options: [1, 2, 3, 4, 5].map((index) => ({
        id: `conclusion-${index}`,
        index: index - 1,
      })),
    })

    expect(compiled).toEqual({
      ok: true,
      contract: expect.objectContaining({
        presentation: {
          kind: 'placement',
          targetIds: [
            'conclusion-1',
            'conclusion-2',
            'conclusion-3',
            'conclusion-4',
            'conclusion-5',
          ],
          tokens: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
          reuse: 'unlimited',
          requiredPlacements: 5,
        },
      }),
    })
    if (!compiled.ok) throw new Error('Expected a valid contract')

    const result = evaluateResponse(compiled.contract, {
      kind: 'placement',
      placements: {
        'conclusion-1': 'yes',
        'conclusion-2': 'no',
        'conclusion-3': 'yes',
        'conclusion-4': 'yes',
        'conclusion-5': 'no',
      },
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        complete: true,
        score: { awarded: 1, maximum: 2 },
        snapshot: expect.objectContaining({
          type: 'ucat_response_v1',
          answerScheme: 'decision_making_binary_placement',
        }),
        review: expect.objectContaining({
          kind: 'placement',
          outcome: 'partial',
        }),
      })
    )
  })

  it('keeps Situational Judgement rating partial credit inside its answer scheme', () => {
    const compiled = compileResponseContract({
      questionId: 'sj-rating',
      responseType: 'multiple_choice',
      answerScheme: {
        kind: 'situational_judgement_rating',
        correctOptionId: 'appropriate',
      },
      options: [
        { id: 'very-appropriate', index: 0 },
        { id: 'appropriate', index: 1 },
        { id: 'inappropriate', index: 2 },
        { id: 'very-inappropriate', index: 3 },
      ],
    })
    if (!compiled.ok) throw new Error('Expected a valid contract')

    const result = evaluateResponse(compiled.contract, {
      kind: 'single_select',
      selectedOptionId: 'very-appropriate',
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        score: { awarded: 0.5, maximum: 1 },
        review: expect.objectContaining({ outcome: 'partial' }),
      })
    )
  })

  it('supports one Most/Least item with two distinct placements', () => {
    const compiled = compileResponseContract({
      questionId: 'sj-most-least',
      responseType: 'drag_and_drop',
      answerScheme: {
        kind: 'situational_judgement_most_least',
        mostAppropriateOptionId: 'action-a',
        leastAppropriateOptionId: 'action-c',
      },
      options: [
        { id: 'action-a', index: 0 },
        { id: 'action-b', index: 1 },
        { id: 'action-c', index: 2 },
      ],
    })

    expect(compiled).toEqual({
      ok: true,
      contract: expect.objectContaining({
        presentation: {
          kind: 'placement',
          targetIds: ['action-a', 'action-b', 'action-c'],
          tokens: [
            { value: 'most', label: 'Most Appropriate' },
            { value: 'least', label: 'Least Appropriate' },
          ],
          reuse: 'once_each',
          requiredPlacements: 2,
        },
      }),
    })
    if (!compiled.ok) throw new Error('Expected a valid contract')

    const result = evaluateResponse(compiled.contract, {
      kind: 'placement',
      placements: {
        'action-a': 'most',
        'action-b': 'least',
      },
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        complete: true,
        score: { awarded: 6, maximum: 8 },
        review: expect.objectContaining({
          kind: 'placement',
          outcome: 'partial',
        }),
      })
    )
  })

  it('rejects an invalid response contract with deterministic authoring issues', () => {
    const compiled = compileResponseContract({
      questionId: 'invalid-dm',
      responseType: 'multiple_choice',
      answerScheme: {
        kind: 'decision_making_binary_placement',
        correctByOptionId: {
          'unknown-option': 'yes',
        },
      },
      options: [
        { id: 'duplicate', index: 0 },
        { id: 'duplicate', index: 0 },
      ],
    })

    expect(compiled).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({ code: 'duplicate_option_id' }),
        expect.objectContaining({ code: 'duplicate_option_index' }),
        expect.objectContaining({ code: 'non_contiguous_option_order' }),
        expect.objectContaining({ code: 'response_scheme_mismatch' }),
        expect.objectContaining({ code: 'wrong_option_count' }),
        expect.objectContaining({ code: 'missing_key_option' }),
        expect.objectContaining({ code: 'unknown_key_option' }),
      ],
    })
  })

  it('restores canonical persisted state only for the matching question and scheme', () => {
    const compiled = compileResponseContract({
      questionId: 'persisted-question',
      responseType: 'multiple_choice',
      answerScheme: {
        kind: 'single_choice',
        correctOptionId: 'option-a',
      },
      options: [
        { id: 'option-a', index: 0 },
        { id: 'option-b', index: 1 },
      ],
    })
    if (!compiled.ok) throw new Error('Expected a valid contract')

    expect(
      createResponseState(compiled.contract, {
        type: 'ucat_response_v1',
        questionId: 'persisted-question',
        answerScheme: 'single_choice',
        response: {
          kind: 'single_select',
          selectedOptionId: 'option-b',
        },
      })
    ).toEqual({
      ok: true,
      state: { kind: 'single_select', selectedOptionId: 'option-b' },
    })

    expect(
      createResponseState(compiled.contract, {
        type: 'ucat_response_v1',
        questionId: 'different-question',
        answerScheme: 'single_choice',
        response: {
          kind: 'single_select',
          selectedOptionId: 'option-b',
        },
      })
    ).toEqual({
      ok: false,
      issues: [expect.objectContaining({ code: 'snapshot_question_mismatch' })],
    })
  })

  it('rejects a live response that references an unknown option', () => {
    const compiled = compileResponseContract({
      questionId: 'validated-live-response',
      responseType: 'multiple_choice',
      answerScheme: {
        kind: 'single_choice',
        correctOptionId: 'option-a',
      },
      options: [
        { id: 'option-a', index: 0 },
        { id: 'option-b', index: 1 },
      ],
    })
    if (!compiled.ok) throw new Error('Expected a valid contract')

    expect(
      evaluateResponse(compiled.contract, {
        kind: 'single_select',
        selectedOptionId: 'unknown-option',
      })
    ).toEqual({
      ok: false,
      issues: [expect.objectContaining({ code: 'unknown_option' })],
    })
  })

  it('reads a legacy DM snapshot but only emits the canonical snapshot', () => {
    const compiled = compileResponseContract({
      questionId: 'legacy-dm-question',
      responseType: 'drag_and_drop',
      answerScheme: {
        kind: 'decision_making_binary_placement',
        correctByOptionId: {
          'option-1': 'yes',
          'option-2': 'no',
          'option-3': 'yes',
          'option-4': 'no',
          'option-5': 'yes',
        },
      },
      options: [1, 2, 3, 4, 5].map((index) => ({
        id: `option-${index}`,
        index: index - 1,
      })),
    })
    if (!compiled.ok) throw new Error('Expected a valid contract')

    const restored = createResponseState(compiled.contract, {
      type: 'syllogism_v1',
      answers: [
        { question_answer_option_id: 'option-1', answer: true },
        { question_answer_option_id: 'option-2', answer: false },
        { question_answer_option_id: 'option-3', answer: true },
        { question_answer_option_id: 'option-4', answer: false },
        { question_answer_option_id: 'option-5', answer: true },
      ],
    })

    expect(restored).toEqual({
      ok: true,
      state: {
        kind: 'placement',
        placements: {
          'option-1': 'yes',
          'option-2': 'no',
          'option-3': 'yes',
          'option-4': 'no',
          'option-5': 'yes',
        },
      },
    })
    if (!restored.ok) throw new Error('Expected a restored response')

    const evaluated = evaluateResponse(compiled.contract, restored.state)
    expect(evaluated).toEqual(
      expect.objectContaining({
        ok: true,
        snapshot: expect.objectContaining({ type: 'ucat_response_v1' }),
      })
    )
  })

  it('keeps a partially placed DM response incomplete', () => {
    const compiled = compileResponseContract({
      questionId: 'incomplete-dm',
      responseType: 'drag_and_drop',
      answerScheme: {
        kind: 'decision_making_binary_placement',
        correctByOptionId: {
          a: 'yes',
          b: 'no',
          c: 'yes',
          d: 'no',
          e: 'yes',
        },
      },
      options: ['a', 'b', 'c', 'd', 'e'].map((id, index) => ({ id, index })),
    })
    if (!compiled.ok) throw new Error('Expected a valid contract')

    expect(
      evaluateResponse(compiled.contract, {
        kind: 'placement',
        placements: { a: 'yes', b: 'no' },
      })
    ).toEqual(
      expect.objectContaining({
        ok: true,
        complete: false,
        score: { awarded: 0, maximum: 2 },
      })
    )
  })

  it('rejects reuse of a once-only Most/Least token', () => {
    const compiled = compileResponseContract({
      questionId: 'duplicate-most',
      responseType: 'drag_and_drop',
      answerScheme: {
        kind: 'situational_judgement_most_least',
        mostAppropriateOptionId: 'a',
        leastAppropriateOptionId: 'c',
      },
      options: ['a', 'b', 'c'].map((id, index) => ({ id, index })),
    })
    if (!compiled.ok) throw new Error('Expected a valid contract')

    expect(
      evaluateResponse(compiled.contract, {
        kind: 'placement',
        placements: { a: 'most', b: 'most' },
      })
    ).toEqual({
      ok: false,
      issues: [expect.objectContaining({ code: 'token_reused' })],
    })
  })

  it('does not award provisional Most/Least points for an incomplete response', () => {
    const compiled = compileResponseContract({
      questionId: 'incomplete-most-least',
      responseType: 'drag_and_drop',
      answerScheme: {
        kind: 'situational_judgement_most_least',
        mostAppropriateOptionId: 'action-a',
        leastAppropriateOptionId: 'action-c',
      },
      options: ['action-a', 'action-b', 'action-c'].map((id, index) => ({
        id,
        index,
      })),
    })
    if (!compiled.ok) throw new Error('Expected a valid contract')

    expect(
      evaluateResponse(compiled.contract, {
        kind: 'placement',
        placements: { 'action-a': 'most' },
      })
    ).toEqual(
      expect.objectContaining({
        ok: true,
        complete: false,
        score: { awarded: 0, maximum: 8 },
        review: expect.objectContaining({ outcome: 'unanswered' }),
      })
    )
  })
})
