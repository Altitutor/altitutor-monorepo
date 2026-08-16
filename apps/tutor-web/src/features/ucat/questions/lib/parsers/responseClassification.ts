export type InferenceConfidence = 'certain' | 'strong' | 'weak' | 'absent'

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
  reviewState: 'prefilled' | 'confirmation_required' | 'review_required' | 'blocked'
}

export type ResponseContractInferenceInput = {
  directive: string
  targetCount: number
  optionTexts?: readonly string[]
  answerEvidenceKind?:
    | 'single_choice'
    | 'binary_sequence'
    | 'most_least_pair'
}

export function answerEvidenceFitsOptionCount(
  evidence: UntypedAnswerEvidence,
  optionCount: number
): boolean {
  if (!evidence.kind || evidence.conflicts.length > 0) return false
  if (evidence.keyValues.slice(optionCount).some((value) => value !== null)) return false
  if (evidence.kind === 'binary_sequence') {
    return optionCount === 5 && evidence.keyValues.length === 5
  }
  if (evidence.kind === 'most_least_pair') {
    return optionCount === 3 &&
      evidence.keyValues.filter((value) => value === 'most').length === 1 &&
      evidence.keyValues.filter((value) => value === 'least').length === 1
  }
  return evidence.keyValues.filter((value) => value === 'correct').length === 1
}

export type AnswerEvidenceKind = NonNullable<
  ResponseContractInferenceInput['answerEvidenceKind']
>

export type AnswerKeyInferenceValue = 'correct' | 'yes' | 'no' | 'most' | 'least' | null

export type UntypedAnswerEvidence = {
  kind: AnswerEvidenceKind | null
  confidence: InferenceConfidence
  keyValues: AnswerKeyInferenceValue[]
  evidence: string[]
  conflicts: string[]
}

export type DecisionMakingCategoryInferenceValue =
  | 'Syllogisms'
  | 'Interpreting Information and Drawing Conclusions'

const FORMAL_PREMISE_SIGNAL_PATTERNS = [
  ['all', /\ball\b/u],
  ['some', /\bsome\b/u],
  ['no', /\bno\b/u],
  ['none', /\bnone\b/u],
  ['every', /\bevery\b/u],
  ['never', /\bnever\b/u],
] as const

const FACTUAL_DATA_SIGNAL_PATTERNS = [
  ['table', /\btable\b/u],
  ['chart', /\bchart\b/u],
  ['graph', /\bgraph\b/u],
  ['passage', /\bpassage\b/u],
  ['data', /\bdata\b/u],
  ['information', /\binformation\b/u],
  ['report', /\breport\b/u],
  ['survey', /\bsurvey\b/u],
  ['study', /\bstudy\b/u],
  ['figure', /\bfigures?\b/u],
  ['diagram', /\bdiagram\b/u],
  ['image', /\bimage\b/u],
] as const

/** Visual presentation cues used to prefer Interpreting Information over Syllogisms. */
const VISUAL_PRESENTATION_PATTERNS = [
  /\btable\b/u,
  /\bchart\b/u,
  /\bgraph\b/u,
  /\bfigures?\b/u,
  /\bdiagram\b/u,
  /\bimage\b/u,
] as const

const LEADING_QUANTIFIER_PATTERN = /^(?:all|every|some|no|none|never)\b/u
const COORDINATED_QUANTIFIER_PATTERN = /\band\s+(?:all|every|some|no|none|never)\b/gu

export type DecisionMakingFormalPremiseSignal =
  (typeof FORMAL_PREMISE_SIGNAL_PATTERNS)[number][0]
export type DecisionMakingFactualDataSignal =
  (typeof FACTUAL_DATA_SIGNAL_PATTERNS)[number][0]

export type DecisionMakingCategoryEvidence = {
  isConclusionTask: boolean
  formalPremiseSignals: DecisionMakingFormalPremiseSignal[]
  factualDataSignals: DecisionMakingFactualDataSignal[]
  hasVisualPresentation: boolean
  quantifiedPremiseStatementCount: number
}

/**
 * Count quantified premise clauses without treating mid-prose "some customers" as
 * a premise. Prefer sentence-initial All/Some/No/… and coordinated "and no/all…".
 */
function countQuantifiedPremiseStatements(stemText: string): number {
  const sentences = stemText
    .split(/[.!?]+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)

  let count = 0
  for (const sentence of sentences) {
    const probe = normalizeProbe(sentence)
    if (!probe) continue
    if (LEADING_QUANTIFIER_PATTERN.test(probe)) count += 1
    const coordinated = probe.match(COORDINATED_QUANTIFIER_PATTERN)
    if (coordinated) count += coordinated.length
  }
  return count
}

function hasVisualPresentationMarkers(stemText: string, probe: string): boolean {
  if (/\[\[(?:IMG|TABLE):/iu.test(stemText)) return true
  return VISUAL_PRESENTATION_PATTERNS.some((pattern) => pattern.test(probe))
}

/** Semantic DM category evidence; deliberately has no response-contract input. */
export function extractDecisionMakingCategoryEvidence(input: {
  stemText: string
  directive: string
}): DecisionMakingCategoryEvidence {
  const probe = normalizeProbe(input.stemText)
  const directiveProbe = normalizeProbe(input.directive)
  const factualDataSignals = FACTUAL_DATA_SIGNAL_PATTERNS
    .filter(([, pattern]) => pattern.test(probe))
    .map(([signal]) => signal)
  if (/\[\[IMG:/iu.test(input.stemText) && !factualDataSignals.includes('image')) {
    factualDataSignals.push('image')
  }
  if (/\[\[TABLE:/iu.test(input.stemText) && !factualDataSignals.includes('table')) {
    factualDataSignals.push('table')
  }
  return {
    isConclusionTask:
      /\bconclusions?\b/u.test(directiveProbe) &&
      /\bfollows?\b/u.test(directiveProbe),
    formalPremiseSignals: FORMAL_PREMISE_SIGNAL_PATTERNS
      .filter(([, pattern]) => pattern.test(probe))
      .map(([signal]) => signal),
    factualDataSignals,
    hasVisualPresentation: hasVisualPresentationMarkers(input.stemText, probe),
    quantifiedPremiseStatementCount: countQuantifiedPremiseStatements(input.stemText),
  }
}

export function inferAnswerEvidenceFromKeyValues(
  keyValues: readonly AnswerKeyInferenceValue[]
): UntypedAnswerEvidence {
  const present = keyValues.filter(
    (value): value is Exclude<AnswerKeyInferenceValue, null> => value !== null
  )
  const families = new Set(
    present.map((value) =>
      value === 'correct' ? 'single' : value === 'yes' || value === 'no' ? 'binary' : 'most_least'
    )
  )
  if (families.size > 1) {
    return {
      kind: null,
      confidence: 'certain',
      keyValues: [...keyValues],
      evidence: ['canonical_answer_keys'],
      conflicts: ['conflicting_answer_key_shapes'],
    }
  }
  const family = [...families][0]
  if (family === 'single' && present.filter((value) => value === 'correct').length === 1) {
    return { kind: 'single_choice', confidence: 'certain', keyValues: [...keyValues], evidence: ['canonical_answer_keys'], conflicts: [] }
  }
  if (family === 'binary' && keyValues.length === 5 && present.length === 5) {
    return { kind: 'binary_sequence', confidence: 'certain', keyValues: [...keyValues], evidence: ['canonical_answer_keys'], conflicts: [] }
  }
  if (
    family === 'most_least' &&
    present.filter((value) => value === 'most').length === 1 &&
    present.filter((value) => value === 'least').length === 1
  ) {
    return { kind: 'most_least_pair', confidence: 'certain', keyValues: [...keyValues], evidence: ['canonical_answer_keys'], conflicts: [] }
  }
  return {
    kind: null,
    confidence: present.length > 0 ? 'weak' : 'absent',
    keyValues: [...keyValues],
    evidence: present.length > 0 ? ['incomplete_answer_keys'] : [],
    conflicts: [],
  }
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

function binaryKeyValues(input: string): AnswerKeyInferenceValue[] | null {
  const normalized = input.trim().toLowerCase()
  const compact = normalized.replace(/[^yn]/gu, '')
  if (/^[yn]{5}$/u.test(normalized)) {
    return [...normalized].map((token) => (token === 'y' ? 'yes' : 'no'))
  }

  const tokens = normalized
    .split(/[\s,;|/]+/u)
    .filter(Boolean)
  if (
    tokens.length === 5 &&
    tokens.every((token) => /^(?:y|ye|yes|n|no)$/u.test(token))
  ) {
    return tokens.map((token) => (token.startsWith('y') ? 'yes' : 'no'))
  }

  // Do not accept arbitrary prose merely because it contains five y/n letters.
  if (compact.length === 5 && /^[yn]{5}$/u.test(compact) && /^[yn\s,;|/]+$/u.test(normalized)) {
    return [...compact].map((token) => (token === 'y' ? 'yes' : 'no'))
  }
  return null
}

function labelledMostLeastKeyValues(input: string): AnswerKeyInferenceValue[] | null {
  const normalized = normalizeProbe(input)
  const mostThenLeast = /\bmost(?: appropriate)?\s+([a-e])\b.*\bleast(?: appropriate)?\s+([a-e])\b/u.exec(normalized)
  const leastThenMost = /\bleast(?: appropriate)?\s+([a-e])\b.*\bmost(?: appropriate)?\s+([a-e])\b/u.exec(normalized)
  const most = mostThenLeast?.[1] ?? leastThenMost?.[2]
  const least = mostThenLeast?.[2] ?? leastThenMost?.[1]
  if (!most || !least || most === least) return null
  const length = Math.max(most.charCodeAt(0), least.charCodeAt(0)) - 96
  const keys: AnswerKeyInferenceValue[] = Array.from({ length }, () => null)
  keys[most.charCodeAt(0) - 97] = 'most'
  keys[least.charCodeAt(0) - 97] = 'least'
  return keys
}

/**
 * Parse answer evidence before a response type or legacy question type is known.
 * The result deliberately preserves ambiguity and conflicts for reconciliation.
 */
function parseOneUntypedAnswerEvidence(trimmed: string): UntypedAnswerEvidence {
  const lines = trimmed.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
  const firstField = trimmed.split('\t')[0]?.trim() ?? trimmed
  const binary = binaryKeyValues(trimmed) ?? binaryKeyValues(firstField) ?? lines.map(binaryKeyValues).find((value) => value != null) ?? null
  const mostLeast = labelledMostLeastKeyValues(trimmed) ?? lines.map(labelledMostLeastKeyValues).find((value) => value != null) ?? null
  if (binary && mostLeast) {
    return {
      kind: null,
      confidence: 'certain',
      keyValues: [],
      evidence: ['five_binary_tokens', 'labelled_most_least_pair'],
      conflicts: ['conflicting_answer_shapes'],
    }
  }
  if (binary) {
    return {
      kind: 'binary_sequence',
      confidence: 'certain',
      keyValues: binary,
      evidence: ['five_binary_tokens'],
      conflicts: [],
    }
  }
  if (mostLeast) {
    return {
      kind: 'most_least_pair',
      confidence: 'certain',
      keyValues: mostLeast,
      evidence: ['labelled_most_least_pair'],
      conflicts: [],
    }
  }
  const singleLetter = /^([a-e])(?:\t.*)?$/iu.exec(trimmed)?.[1]
  if (singleLetter) {
    const index = singleLetter.toUpperCase().charCodeAt(0) - 65
    const keyValues: AnswerKeyInferenceValue[] = Array.from({ length: index + 1 }, () => null)
    keyValues[index] = 'correct'
    return {
      kind: 'single_choice',
      confidence: 'certain',
      keyValues,
      evidence: ['single_answer_letter'],
      conflicts: [],
    }
  }
  if (/^[a-e]{2}$/iu.test(trimmed)) {
    return {
      kind: null,
      confidence: 'weak',
      keyValues: [],
      evidence: ['ambiguous_compact_pair'],
      conflicts: [],
    }
  }
  if (/^[a-z]$/iu.test(trimmed)) {
    return {
      kind: null,
      confidence: 'absent',
      keyValues: [],
      evidence: [],
      conflicts: ['invalid_answer_letter'],
    }
  }
  return { kind: null, confidence: 'absent', keyValues: [], evidence: [], conflicts: [] }
}

function numberedAnswerRows(input: string): string[] | null {
  const lines = input.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
  const dataLines = lines.filter(
    (line) => !/^(?:question|q|number|no\.?)\b.*\banswer\b/iu.test(line)
  )
  const groups = new Map<number, string[]>()
  let pendingNumber: number | null = null
  for (const line of dataLines) {
    const numbered = /^(?:q(?:uestion)?\s*)?(\d+)[.)]?\s*(?:\t|\s)+(.*\S)\s*$/iu.exec(line)
    if (numbered) {
      const number = Number(numbered[1])
      const values = groups.get(number) ?? []
      const payload = numbered[2] ?? ''
      const isCompleteShape = binaryKeyValues(payload) || labelledMostLeastKeyValues(payload)
      const leadingToken = isCompleteShape
        ? null
        : /^(yes|ye|y|no|n|[a-e])(?:\s+|\t).+$/iu.exec(payload)?.[1]
      values.push(leadingToken ?? payload)
      groups.set(number, values)
      pendingNumber = null
      continue
    }
    const numberOnly = /^(?:q(?:uestion)?\s*)?(\d+)[.)]?$/iu.exec(line)
    if (numberOnly) {
      pendingNumber = Number(numberOnly[1])
      if (!groups.has(pendingNumber)) groups.set(pendingNumber, [])
      continue
    }
    if (pendingNumber != null) {
      groups.get(pendingNumber)?.push(line)
      pendingNumber = null
      continue
    }
    return null
  }
  if (groups.size === 0) return null
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, values]) => values.join('\n'))
}

/**
 * Parse answer evidence before a response type or legacy question type is known.
 * Numbered answer tables are split structurally, then each row is classified by shape.
 */
export function parseUntypedAnswerEvidence(input: string): UntypedAnswerEvidence[] {
  const trimmed = input.trim()
  if (!trimmed) {
    return [{ kind: null, confidence: 'absent', keyValues: [], evidence: [], conflicts: [] }]
  }
  const rows = numberedAnswerRows(trimmed)
  if (rows) return rows.map(parseOneUntypedAnswerEvidence)
  const whole = parseOneUntypedAnswerEvidence(trimmed)
  if (whole.kind || whole.conflicts.length > 0 || whole.evidence.length > 0) return [whole]
  const lines = trimmed.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
  const lineEvidence = lines.map(parseOneUntypedAnswerEvidence)
  if (lineEvidence.length > 1 && lineEvidence.every((item) => item.kind !== null)) {
    return lineEvidence
  }
  return [whole]
}

/**
 * Category inference for Yes/No conclusion tasks.
 * Decision tree: visual presentation → Interpreting Information;
 * strong quantified premises → Syllogisms; otherwise Interpreting Information.
 * Intentionally independent of interaction and answer tokens.
 */
export function inferDecisionMakingCategory(input: {
  stemText: string
  directive: string
  trustedCategoryName?: DecisionMakingCategoryInferenceValue | null
}): Inference<DecisionMakingCategoryInferenceValue> {
  if (input.trustedCategoryName) {
    return {
      value: input.trustedCategoryName,
      confidence: 'certain',
      evidence: ['trusted_category_heading'],
      conflicts: [],
    }
  }

  const categoryEvidence = extractDecisionMakingCategoryEvidence(input)
  if (!categoryEvidence.isConclusionTask) {
    return { value: null, confidence: 'absent', evidence: [], conflicts: [] }
  }
  if (categoryEvidence.hasVisualPresentation) {
    return {
      value: 'Interpreting Information and Drawing Conclusions',
      confidence: 'strong',
      evidence: ['visual_presentation'],
      conflicts: [],
    }
  }
  if (categoryEvidence.quantifiedPremiseStatementCount >= 2) {
    return {
      value: 'Syllogisms',
      confidence: 'strong',
      evidence: ['formal_quantified_premises'],
      conflicts: [],
    }
  }
  return {
    value: 'Interpreting Information and Drawing Conclusions',
    confidence: 'strong',
    evidence: ['prose_information_presentation'],
    conflicts: [],
  }
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
  if (input.answerEvidenceKind) {
    const answerValue: ResponseTypeInferenceValue =
      input.answerEvidenceKind === 'binary_sequence' ||
      input.answerEvidenceKind === 'most_least_pair'
        ? 'drag_and_drop'
        : 'multiple_choice'
    const structuralValue: ResponseTypeInferenceValue | null =
      (input.targetCount === 5 &&
        binaryConclusionDirective(input.directive)) ||
      (input.targetCount === 3 &&
        pairedMostLeastDirective(input.directive))
        ? 'drag_and_drop'
        : looksLikeSituationalJudgementRatingScale(input.optionTexts ?? [])
          ? 'multiple_choice'
          : null
    return {
      value: answerValue,
      confidence: 'certain',
      evidence: [`${input.answerEvidenceKind}_answer_shape`],
      conflicts:
        structuralValue !== null && structuralValue !== answerValue
          ? ['contradictory_response_type_evidence']
          : [],
    }
  }
  if (
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
    looksLikeSituationalJudgementRatingScale(input.optionTexts ?? [])
  ) {
    return {
      value: 'multiple_choice',
      confidence: 'strong',
      evidence: ['situational_judgement_rating_scale'],
      conflicts: [],
    }
  }

  return { value: null, confidence: 'absent', evidence: [], conflicts: [] }
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
        looksLikeSituationalJudgementRatingScale(input.optionTexts ?? [])
          ? 'situational_judgement_rating'
          : 'single_choice',
      confidence: 'certain',
      evidence: ['single_choice_answer'],
      conflicts: [],
    }
  }
  if (
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
    looksLikeSituationalJudgementRatingScale(input.optionTexts ?? [])
  ) {
    return {
      value: 'situational_judgement_rating',
      confidence: 'strong',
      evidence: ['situational_judgement_rating_scale'],
      conflicts: [],
    }
  }
  return { value: null, confidence: 'absent', evidence: [], conflicts: [] }
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
  const contractConflicts =
    responseType.value !== null &&
    answerScheme.value !== null &&
    expectedResponseType(answerScheme.value) !== responseType.value
      ? ['response_type_answer_scheme_mismatch']
      : []
  const conflicts = [...new Set([...responseType.conflicts, ...answerScheme.conflicts, ...contractConflicts])]

  return {
    responseType: { ...responseType, conflicts },
    answerScheme: { ...answerScheme, conflicts },
    reviewState:
      conflicts.length > 0
        ? 'blocked'
        : responseType.value === null || answerScheme.value === null ||
            responseType.confidence === 'weak' || answerScheme.confidence === 'weak' ||
            responseType.confidence === 'absent' || answerScheme.confidence === 'absent'
          ? 'review_required'
          : responseType.confidence === 'certain' && answerScheme.confidence === 'certain'
            ? 'prefilled'
            : 'confirmation_required',
  }
}

export type IngestedResponseContractInput = {
  directive: string
  optionTexts: readonly string[]
  declaredResponseType?: ResponseTypeInferenceValue
  declaredAnswerScheme?: AnswerSchemeInferenceValue
  answerKeyValues: readonly AnswerKeyInferenceValue[]
}

export type ReconciledIngestedResponseContract = {
  responseType: ResponseTypeInferenceValue
  answerScheme: AnswerSchemeInferenceValue
  answerKeyValues: AnswerKeyInferenceValue[]
  inference: ResponseContractInference
  conflicts: string[]
}

/** Shared reconciliation boundary for generated, MCP, manual, and import payloads. */
export function reconcileIngestedResponseContract(
  input: IngestedResponseContractInput
): ReconciledIngestedResponseContract {
  const answerKeyValues: AnswerKeyInferenceValue[] = [...input.answerKeyValues]
  const answerEvidence = inferAnswerEvidenceFromKeyValues(answerKeyValues)
  const inference = inferResponseContract({
    directive: input.directive,
    targetCount: input.optionTexts.length,
    optionTexts: input.optionTexts,
    answerEvidenceKind: answerEvidence.kind ?? undefined,
  })
  const responseType = inference.responseType.value ??
    input.declaredResponseType ??
    'multiple_choice'
  const answerScheme = inference.answerScheme.value ??
    input.declaredAnswerScheme ??
    'single_choice'
  const conflicts = new Set<string>(answerEvidence.conflicts)
  if (inference.reviewState === 'blocked') conflicts.add('conflicting_response_evidence')
  if (
    answerEvidence.kind &&
    !answerEvidenceFitsOptionCount(answerEvidence, input.optionTexts.length)
  ) {
    conflicts.add('answer_keys_out_of_range')
  }
  if (input.declaredResponseType && input.declaredResponseType !== responseType) {
    conflicts.add('declared_response_type_mismatch')
  }
  if (input.declaredAnswerScheme && input.declaredAnswerScheme !== answerScheme) {
    conflicts.add('declared_answer_scheme_mismatch')
  }
  if (answerScheme === 'situational_judgement_most_least' && !answerEvidence.kind) {
    conflicts.add('missing_most_least_keys')
  }
  return {
    responseType,
    answerScheme,
    answerKeyValues,
    inference,
    conflicts: [...conflicts],
  }
}
