import {
  extractDecisionMakingCategoryEvidence,
  inferDecisionMakingCategory,
  inferAnswerEvidenceFromKeyValues,
  inferResponseContract,
  parseUntypedAnswerEvidence,
  reconcileIngestedResponseContract,
} from '../responseClassification'

describe('inferResponseContract', () => {
  it('detects a five-target Decision Making binary placement directive', () => {
    expect(
      inferResponseContract({
        directive:
          "Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.",
        targetCount: 5,
      })
    ).toEqual({
      responseType: {
        value: 'drag_and_drop',
        confidence: 'strong',
        evidence: ['binary_conclusion_directive', 'five_targets'],
        conflicts: [],
      },
      answerScheme: {
        value: 'decision_making_binary_placement',
        confidence: 'strong',
        evidence: ['binary_conclusion_directive', 'five_targets'],
        conflicts: [],
      },
      reviewState: 'confirmation_required',
    })
  })

  it('detects a three-action Situational Judgement Most/Least directive', () => {
    expect(
      inferResponseContract({
        directive:
          'Choose both the one most appropriate action and the one least appropriate action.',
        targetCount: 3,
      })
    ).toEqual({
      responseType: {
        value: 'drag_and_drop',
        confidence: 'strong',
        evidence: ['paired_most_least_directive', 'three_actions'],
        conflicts: [],
      },
      answerScheme: {
        value: 'situational_judgement_most_least',
        confidence: 'strong',
        evidence: ['paired_most_least_directive', 'three_actions'],
        conflicts: [],
      },
      reviewState: 'confirmation_required',
    })
  })

  it('does not treat an incidental most-appropriate phrase as placement', () => {
    expect(
      inferResponseContract({
        directive: 'Speak to a senior doctor about the most appropriate action.',
        targetCount: 4,
        optionTexts: [
          'A very appropriate thing to do',
          'Appropriate but not ideal',
          'Inappropriate but not awful',
          'A very inappropriate thing to do',
        ],
      })
    ).toEqual({
      responseType: {
        value: 'multiple_choice',
        confidence: 'strong',
        evidence: ['situational_judgement_rating_scale'],
        conflicts: [],
      },
      answerScheme: {
        value: 'situational_judgement_rating',
        confidence: 'strong',
        evidence: ['situational_judgement_rating_scale'],
        conflicts: [],
      },
      reviewState: 'confirmation_required',
    })
  })

  it('preserves conflicting interaction and answer evidence for review', () => {
    expect(
      inferResponseContract({
        directive:
          "Place 'Yes' if the conclusion follows. Place 'No' if it does not follow.",
        targetCount: 5,
        answerEvidenceKind: 'single_choice',
      })
    ).toEqual({
      responseType: {
        value: 'multiple_choice',
        confidence: 'certain',
        evidence: ['single_choice_answer_shape'],
        conflicts: ['contradictory_response_type_evidence'],
      },
      answerScheme: {
        value: 'single_choice',
        confidence: 'certain',
        evidence: ['single_choice_answer'],
        conflicts: ['contradictory_response_type_evidence'],
      },
      reviewState: 'blocked',
    })
  })

  it('keeps five ordinary multiple-choice options out of drag classification', () => {
    expect(
      inferResponseContract({
        directive: 'Which one of the following statements is best supported?',
        targetCount: 5,
        optionTexts: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'],
      })
    ).toMatchObject({
      responseType: { value: null, confidence: 'absent' },
      answerScheme: { value: null, confidence: 'absent' },
      reviewState: 'review_required',
    })
  })

  it('does not treat a generic image as drag evidence', () => {
    expect(
      inferResponseContract({
        directive: 'Which option completes the diagram?',
        targetCount: 5,
        optionTexts: ['[[IMG:a]]', '[[IMG:b]]', '[[IMG:c]]', '[[IMG:d]]', '[[IMG:e]]'],
      })
    ).toMatchObject({
      responseType: { value: null, confidence: 'absent' },
      answerScheme: { value: null, confidence: 'absent' },
    })
  })
})

describe('parseUntypedAnswerEvidence', () => {
  it.each([
    ['Y N N Y N', ['yes', 'no', 'no', 'yes', 'no']],
    ['YNNYN', ['yes', 'no', 'no', 'yes', 'no']],
    ['No, yes, no, no, yes', ['no', 'yes', 'no', 'no', 'yes']],
  ])('parses five-token binary evidence without a legacy question type: %s', (input, keyValues) => {
    expect(parseUntypedAnswerEvidence(input)).toEqual([
      {
        kind: 'binary_sequence',
        confidence: 'certain',
        keyValues,
        evidence: ['five_binary_tokens'],
        conflicts: [],
      },
    ])
  })

  it('parses labelled Most/Least evidence', () => {
    expect(parseUntypedAnswerEvidence('Most: B\tLeast: C')).toEqual([
      {
        kind: 'most_least_pair',
        confidence: 'certain',
        keyValues: [null, 'most', 'least'],
        evidence: ['labelled_most_least_pair'],
        conflicts: [],
      },
    ])
  })

  it('leaves ambiguous compact answer pairs for review', () => {
    expect(parseUntypedAnswerEvidence('BC')).toEqual([
      {
        kind: null,
        confidence: 'weak',
        keyValues: [],
        evidence: ['ambiguous_compact_pair'],
        conflicts: [],
      },
    ])
  })

  it('reports invalid answer letters instead of coercing them to option A', () => {
    expect(parseUntypedAnswerEvidence('F')).toEqual([
      {
        kind: null,
        confidence: 'absent',
        keyValues: [],
        evidence: [],
        conflicts: ['invalid_answer_letter'],
      },
    ])
  })

  it('preserves contradictory answer shapes as a blocking conflict', () => {
    expect(parseUntypedAnswerEvidence('YNNYN\nMost: B Least: C')).toEqual([
      expect.objectContaining({
        kind: null,
        conflicts: ['conflicting_answer_shapes'],
      }),
    ])
  })

  it('parses mixed answer-table rows independently by shape', () => {
    expect(
      parseUntypedAnswerEvidence(
        'Question\tAnswer\n1\tC\n2\tY N N Y N\n3\tMost: B\tLeast: C'
      )
    ).toEqual([
      expect.objectContaining({ kind: 'single_choice' }),
      expect.objectContaining({ kind: 'binary_sequence' }),
      expect.objectContaining({ kind: 'most_least_pair' }),
    ])
  })
})

describe('inferAnswerEvidenceFromKeyValues', () => {
  it('infers each canonical key shape without category input', () => {
    expect(inferAnswerEvidenceFromKeyValues([null, 'correct'])).toMatchObject({ kind: 'single_choice' })
    expect(inferAnswerEvidenceFromKeyValues(['yes', 'no', 'yes', 'no', 'no'])).toMatchObject({ kind: 'binary_sequence' })
    expect(inferAnswerEvidenceFromKeyValues(['most', null, 'least'])).toMatchObject({ kind: 'most_least_pair' })
  })

  it('blocks mixed canonical key families', () => {
    expect(inferAnswerEvidenceFromKeyValues(['correct', 'yes'])).toMatchObject({
      kind: null,
      conflicts: ['conflicting_answer_key_shapes'],
    })
  })
})

describe('reconcileIngestedResponseContract', () => {
  it('preserves canonical binary keys at every ingestion boundary', () => {
    expect(reconcileIngestedResponseContract({
      directive: "Place 'Yes' if the conclusion follows and 'No' if it does not.",
      optionTexts: ['One', 'Two', 'Three', 'Four', 'Five'],
      answerKeyValues: ['yes', 'no', 'yes', 'no', 'no'],
    })).toMatchObject({
      responseType: 'drag_and_drop',
      answerScheme: 'decision_making_binary_placement',
      answerKeyValues: ['yes', 'no', 'yes', 'no', 'no'],
      conflicts: [],
    })
  })

  it('blocks declared fields that contradict structural and key evidence', () => {
    expect(reconcileIngestedResponseContract({
      directive: "Place 'Yes' if the conclusion follows and 'No' if it does not.",
      optionTexts: ['One', 'Two', 'Three', 'Four', 'Five'],
      declaredResponseType: 'multiple_choice',
      declaredAnswerScheme: 'single_choice',
      answerKeyValues: ['yes', 'no', 'yes', 'no', 'no'],
    }).conflicts).toEqual(expect.arrayContaining([
      'declared_response_type_mismatch',
      'declared_answer_scheme_mismatch',
    ]))
  })
})

describe('inferDecisionMakingCategory', () => {
  const yesNoDirective =
    "Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow."

  it('extracts auditable semantic signals independently of interaction shape', () => {
    expect(
      extractDecisionMakingCategoryEvidence({
        stemText:
          'A survey table reports that all pharmacists are readers and no readers are pilots.',
        directive: 'Determine which conclusions follow.',
      })
    ).toEqual({
      isConclusionTask: true,
      formalPremiseSignals: ['all', 'no'],
      factualDataSignals: ['table', 'survey'],
      hasVisualPresentation: true,
      // Mid-sentence "that all … and no …" counts the coordinated "and no" clause only;
      // sentence-initial quantifiers are absent because the sentence opens with "A survey…".
      quantifiedPremiseStatementCount: 1,
    })
  })

  it('classifies formal quantified premises as Syllogisms', () => {
    expect(
      inferDecisionMakingCategory({
        stemText: 'All architects are readers. Some readers are musicians. No musician is a pilot.',
        directive: yesNoDirective,
      })
    ).toMatchObject({ value: 'Syllogisms', confidence: 'strong', conflicts: [] })
  })

  it('classifies visual presentations as Interpreting Information and Drawing Conclusions', () => {
    expect(
      inferDecisionMakingCategory({
        stemText: 'The table shows clinic attendance by month and age group.',
        directive: yesNoDirective,
      })
    ).toMatchObject({
      value: 'Interpreting Information and Drawing Conclusions',
      confidence: 'strong',
      conflicts: [],
    })
  })

  it('prefers Interpreting Information when a visual stem also has quantified wording', () => {
    expect(
      inferDecisionMakingCategory({
        stemText: 'The table shows that all architects are readers and no readers attended in May.',
        directive: yesNoDirective,
      })
    ).toMatchObject({
      value: 'Interpreting Information and Drawing Conclusions',
      confidence: 'strong',
      conflicts: [],
    })
  })

  it('classifies mixed universal and particular syllogism premises as Syllogisms', () => {
    expect(
      inferDecisionMakingCategory({
        stemText:
          'All the patients in the respiratory ward who are smokers are women. Patient A is not a smoker. All the smokers on the ward live in the city. Patient B lives in the city.',
        directive: yesNoDirective,
      })
    ).toMatchObject({ value: 'Syllogisms', confidence: 'strong', conflicts: [] })
  })

  it('classifies prose information passages as Interpreting Information despite incidental quantifiers', () => {
    expect(
      inferDecisionMakingCategory({
        stemText:
          'For small independent companies, where the company values are not the priority, selling their business out to larger corporate companies can boost sales significantly. Small companies can benefit from the expertise and vast resources that large corporations can certainly offer. Provided that it is well managed, independent companies that have been bought out by corporate companies can expand their businesses at a rate that is not achievable had they not have had the input of large corporations. The involvement of a corporate company is known to compromise the devotion of some customers, particularly those who prefer independent companies.',
        directive: yesNoDirective,
      })
    ).toMatchObject({
      value: 'Interpreting Information and Drawing Conclusions',
      confidence: 'strong',
      conflicts: [],
    })
  })

  it('treats image tokens as visual Interpreting Information evidence', () => {
    expect(
      inferDecisionMakingCategory({
        stemText: '[[IMG:asset-1]] Attendance by clinic.',
        directive: yesNoDirective,
      })
    ).toMatchObject({
      value: 'Interpreting Information and Drawing Conclusions',
      evidence: expect.arrayContaining(['visual_presentation']),
      conflicts: [],
    })
  })

  it('does not classify an ordinary factual table without a conclusion task', () => {
    expect(inferDecisionMakingCategory({
      stemText: 'The table shows five appointments and their costs.',
      directive: 'Which appointment costs the most?',
    })).toMatchObject({ value: null, confidence: 'absent', conflicts: [] })
  })
})
