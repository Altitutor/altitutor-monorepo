import { inferResponseContract } from '../responseClassification'

describe('inferResponseContract', () => {
  it('detects a five-target Decision Making binary placement directive', () => {
    expect(
      inferResponseContract({
        sectionName: 'Decision Making',
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
      reviewState: 'confirmed',
    })
  })

  it('detects a three-action Situational Judgement Most/Least directive', () => {
    expect(
      inferResponseContract({
        sectionName: 'Situational Judgement',
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
      reviewState: 'confirmed',
    })
  })

  it('does not treat an incidental most-appropriate phrase as placement', () => {
    expect(
      inferResponseContract({
        sectionName: 'Situational Judgement',
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
      reviewState: 'confirmed',
    })
  })

  it('preserves conflicting interaction and answer evidence for review', () => {
    expect(
      inferResponseContract({
        sectionName: 'Decision Making',
        directive:
          "Place 'Yes' if the conclusion follows. Place 'No' if it does not follow.",
        targetCount: 5,
        answerEvidenceKind: 'single_choice',
      })
    ).toEqual({
      responseType: {
        value: 'drag_and_drop',
        confidence: 'strong',
        evidence: ['binary_conclusion_directive', 'five_targets'],
        conflicts: ['response_type_answer_scheme_mismatch'],
      },
      answerScheme: {
        value: 'single_choice',
        confidence: 'certain',
        evidence: ['single_choice_answer'],
        conflicts: ['response_type_answer_scheme_mismatch'],
      },
      reviewState: 'conflicting_evidence',
    })
  })
})
