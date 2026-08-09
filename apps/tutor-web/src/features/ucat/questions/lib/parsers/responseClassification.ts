export type InferenceConfidence = 'certain' | 'strong' | 'weak' | 'none'

export type ResponseTypeInferenceValue =
  | 'multiple_choice'
  | 'drag_and_drop'

export type AnswerSchemeInferenceValue =
  | 'single_choice'
  | 'situational_judgement_rating'
  | 'decision_making_binary_placement'
  | 'situational_judgement_most_least'

export type Inference<T> = {
  value: T | null
  confidence: InferenceConfidence
  evidence: string[]
  conflicts: string[]
}

export type ResponseContractInference = {
  responseType: Inference<ResponseTypeInferenceValue>
  answerScheme: Inference<AnswerSchemeInferenceValue>
  reviewState: 'confirmed' | 'review_response_contract' | 'conflicting_evidence'
}

export type ResponseContractInferenceInput = {
  sectionName: string
  directive: string
  targetCount: number
  optionTexts?: readonly string[]
  answerEvidenceKind?:
    | 'single_choice'
    | 'binary_sequence'
    | 'most_least_pair'
}

function normalizeProbe(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’‛‹›]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pairedMostLeastDirective(directive: string): boolean {
  const probe = normalizeProbe(directive)
  return (
    /\bmost appropriate\b/.test(probe) &&
    /\bleast appropriate\b/.test(probe) &&
    /\b(?:choose|select|place|drag)\b/.test(probe)
  )
}

function binaryConclusionDirective(directive: string): boolean {
  const probe = normalizeProbe(directive)
  return (
    /\byes\b/.test(probe) &&
    /\bno\b/.test(probe) &&
    /\bconclusions?\b/.test(probe) &&
    /\bfollows?\b/.test(probe) &&
    /\b(?:place|write|select|drag)\b/.test(probe)
  )
}

function looksLikeSituationalJudgementRatingScale(
  optionTexts: readonly string[]
): boolean {
  if (optionTexts.length !== 4) return false
  const probe = optionTexts.map(normalizeProbe).join(' | ')
  const appropriateMarkers = [
    'very appropriate',
    'appropriate but not ideal',
    'inappropriate but not awful',
    'very inappropriate',
  ]
  const importantMarkers = [
    'very important',
    'important',
    'of minor importance',
    'not important at all',
  ]
  return [appropriateMarkers, importantMarkers].some(
    (markers) => markers.filter((marker) => probe.includes(marker)).length >= 3
  )
}

function inferResponseType(
  input: ResponseContractInferenceInput
): Inference<ResponseTypeInferenceValue> {
  if (
    input.sectionName === 'Decision Making' &&
    input.targetCount === 5 &&
    binaryConclusionDirective(input.directive)
  ) {
    return {
      value: 'drag_and_drop',
      confidence: 'strong',
      evidence: ['binary_conclusion_directive', 'five_targets'],
      conflicts: [],
    }
  }

  if (
    input.sectionName === 'Situational Judgement' &&
    input.targetCount === 3 &&
    pairedMostLeastDirective(input.directive)
  ) {
    return {
      value: 'drag_and_drop',
      confidence: 'strong',
      evidence: ['paired_most_least_directive', 'three_actions'],
      conflicts: [],
    }
  }

  if (
    input.sectionName === 'Situational Judgement' &&
    looksLikeSituationalJudgementRatingScale(input.optionTexts ?? [])
  ) {
    return {
      value: 'multiple_choice',
      confidence: 'strong',
      evidence: ['situational_judgement_rating_scale'],
      conflicts: [],
    }
  }

  return { value: null, confidence: 'none', evidence: [], conflicts: [] }
}

function inferAnswerScheme(
  input: ResponseContractInferenceInput
): Inference<AnswerSchemeInferenceValue> {
  if (input.answerEvidenceKind === 'binary_sequence') {
    return {
      value: 'decision_making_binary_placement',
      confidence: 'certain',
      evidence: ['binary_answer_sequence'],
      conflicts: [],
    }
  }
  if (input.answerEvidenceKind === 'most_least_pair') {
    return {
      value: 'situational_judgement_most_least',
      confidence: 'certain',
      evidence: ['most_least_answer_pair'],
      conflicts: [],
    }
  }
  if (input.answerEvidenceKind === 'single_choice') {
    return {
      value:
        input.sectionName === 'Situational Judgement' &&
        looksLikeSituationalJudgementRatingScale(input.optionTexts ?? [])
          ? 'situational_judgement_rating'
          : 'single_choice',
      confidence: 'certain',
      evidence: ['single_choice_answer'],
      conflicts: [],
    }
  }
  if (
    input.sectionName === 'Decision Making' &&
    input.targetCount === 5 &&
    binaryConclusionDirective(input.directive)
  ) {
    return {
      value: 'decision_making_binary_placement',
      confidence: 'strong',
      evidence: ['binary_conclusion_directive', 'five_targets'],
      conflicts: [],
    }
  }
  if (
    input.sectionName === 'Situational Judgement' &&
    input.targetCount === 3 &&
    pairedMostLeastDirective(input.directive)
  ) {
    return {
      value: 'situational_judgement_most_least',
      confidence: 'strong',
      evidence: ['paired_most_least_directive', 'three_actions'],
      conflicts: [],
    }
  }
  if (
    input.sectionName === 'Situational Judgement' &&
    looksLikeSituationalJudgementRatingScale(input.optionTexts ?? [])
  ) {
    return {
      value: 'situational_judgement_rating',
      confidence: 'strong',
      evidence: ['situational_judgement_rating_scale'],
      conflicts: [],
    }
  }
  return { value: null, confidence: 'none', evidence: [], conflicts: [] }
}

function expectedResponseType(
  answerScheme: AnswerSchemeInferenceValue
): ResponseTypeInferenceValue {
  return answerScheme === 'decision_making_binary_placement' ||
    answerScheme === 'situational_judgement_most_least'
    ? 'drag_and_drop'
    : 'multiple_choice'
}

export function inferResponseContract(
  input: ResponseContractInferenceInput
): ResponseContractInference {
  const responseType = inferResponseType(input)
  const answerScheme = inferAnswerScheme(input)
  const conflicts =
    responseType.value !== null &&
    answerScheme.value !== null &&
    expectedResponseType(answerScheme.value) !== responseType.value
      ? ['response_type_answer_scheme_mismatch']
      : []

  return {
    responseType: { ...responseType, conflicts },
    answerScheme: { ...answerScheme, conflicts },
    reviewState:
      conflicts.length > 0
        ? 'conflicting_evidence'
        : responseType.value !== null && answerScheme.value !== null
          ? 'confirmed'
          : 'review_response_contract',
  }
}
