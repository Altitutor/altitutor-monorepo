export type ResponseType = 'multiple_choice' | 'drag_and_drop'

export type ResponseOption = {
  id: string
  index: number
}

export type PlacementValue = 'yes' | 'no' | 'most' | 'least'

export type AnswerScheme =
  | {
      kind: 'single_choice'
      correctOptionId: string
    }
  | {
      kind: 'situational_judgement_rating'
      correctOptionId: string
    }
  | {
      kind: 'decision_making_binary_placement'
      correctByOptionId: Readonly<Record<string, 'yes' | 'no'>>
    }
  | {
      kind: 'situational_judgement_most_least'
      mostAppropriateOptionId: string
      leastAppropriateOptionId: string
    }

export type ResponseDefinition = {
  questionId: string
  responseType: ResponseType
  answerScheme: AnswerScheme
  options: readonly ResponseOption[]
}

export type SingleSelectResponse = {
  kind: 'single_select'
  selectedOptionId: string | null
}

export type PlacementResponse = {
  kind: 'placement'
  placements: Readonly<Record<string, PlacementValue>>
}

export type CandidateResponse = SingleSelectResponse | PlacementResponse

export type ResponseSnapshotV1 = {
  type: 'ucat_response_v1'
  questionId: string
  answerScheme: AnswerScheme['kind']
  response: CandidateResponse
}

export type ContractIssue = {
  code:
    | 'duplicate_option_id'
    | 'duplicate_option_index'
    | 'non_contiguous_option_order'
    | 'response_scheme_mismatch'
    | 'wrong_option_count'
    | 'missing_key_option'
    | 'unknown_key_option'
    | 'same_most_and_least_option'
    | 'response_kind_mismatch'
    | 'unsupported_snapshot'
    | 'snapshot_question_mismatch'
    | 'snapshot_scheme_mismatch'
    | 'unknown_option'
    | 'unknown_token'
    | 'token_reused'
  path: readonly (string | number)[]
  message: string
}

export type AnswerSchemeContract = {
  responseType: ResponseType
  optionCount: number | { minimum: number }
}

export type PresentationContract =
  | {
      kind: 'single_select'
      optionIds: readonly string[]
    }
  | {
      kind: 'placement'
      targetIds: readonly string[]
      tokens: readonly { value: PlacementValue; label: string }[]
      reuse: 'unlimited' | 'once_each'
      requiredPlacements: number
      /** Overrides the section default for an official scheme-specific layout. */
      displayColumnsOverride?: 1 | 2
      dragDirection: 'tokens_to_options' | 'options_to_tokens'
    }

const compiledContractData = Symbol('compiled-response-contract-data')

type CompiledContractData = {
  answerScheme: AnswerScheme
  optionIds: ReadonlySet<string>
  implementation: SchemeImplementation
}

export type CompiledResponseContract = {
  questionId: string
  responseType: ResponseType
  answerSchemeKind: AnswerScheme['kind']
  orderedOptionIds: readonly string[]
  presentation: PresentationContract
  readonly [compiledContractData]: CompiledContractData
}

type AddContractIssue = (
  code: ContractIssue['code'],
  path: readonly (string | number)[],
  message: string
) => void

type SchemeImplementation = {
  responseType: ResponseType
  optionCount: number | { minimum: number }
  maximumMarks: number
  progressPoints: number
  validateAnswerKey: (
    answerScheme: AnswerScheme,
    orderedOptionIds: readonly string[],
    optionIds: ReadonlySet<string>,
    addIssue: AddContractIssue
  ) => void
  presentation: (orderedOptionIds: readonly string[]) => PresentationContract
  blankState: () => CandidateResponse
  normalize: (
    contract: CompiledResponseContract,
    value: unknown
  ) => CreateResponseStateResult
  evaluate: (
    contract: CompiledResponseContract,
    response: CandidateResponse
  ) => EvaluationResult
}

export type CompileResult =
  | { ok: true; contract: CompiledResponseContract }
  | { ok: false; issues: readonly ContractIssue[] }

export function compileResponseContract(
  definition: ResponseDefinition
): CompileResult {
  const orderedOptions = [...definition.options].sort(
    (left, right) => left.index - right.index
  )
  const orderedOptionIds = orderedOptions.map((option) => option.id)
  const optionIdSet = new Set(orderedOptionIds)
  const optionIndexSet = new Set(orderedOptions.map((option) => option.index))
  const issues: ContractIssue[] = []
  const addIssue = (
    code: ContractIssue['code'],
    path: readonly (string | number)[],
    message: string
  ): void => {
    issues.push({ code, path, message })
  }

  if (optionIdSet.size !== orderedOptions.length) {
    addIssue(
      'duplicate_option_id',
      ['options'],
      'Option identifiers must be unique.'
    )
  }
  if (optionIndexSet.size !== orderedOptions.length) {
    addIssue(
      'duplicate_option_index',
      ['options'],
      'Option indexes must be unique.'
    )
  }
  if (orderedOptions.some((option, index) => option.index !== index)) {
    addIssue(
      'non_contiguous_option_order',
      ['options'],
      'Option indexes must be contiguous from zero.'
    )
  }

  const implementation = schemeImplementations[definition.answerScheme.kind]
  if (definition.responseType !== implementation.responseType) {
    addIssue(
      'response_scheme_mismatch',
      ['responseType'],
      'The Response type is incompatible with the Answer scheme.'
    )
  }

  const validOptionCount =
    typeof implementation.optionCount === 'number'
      ? orderedOptions.length === implementation.optionCount
      : orderedOptions.length >= implementation.optionCount.minimum
  if (!validOptionCount) {
    addIssue(
      'wrong_option_count',
      ['options'],
      typeof implementation.optionCount === 'number'
        ? `This Answer scheme requires exactly ${implementation.optionCount} options.`
        : `This Answer scheme requires at least ${implementation.optionCount.minimum} options.`
    )
  }

  implementation.validateAnswerKey(
    definition.answerScheme,
    orderedOptionIds,
    optionIdSet,
    addIssue
  )

  if (issues.length > 0) return { ok: false, issues }

  return {
    ok: true,
    contract: {
      questionId: definition.questionId,
      responseType: definition.responseType,
      answerSchemeKind: definition.answerScheme.kind,
      orderedOptionIds,
      presentation: implementation.presentation(orderedOptionIds),
      [compiledContractData]: {
        answerScheme: definition.answerScheme,
        optionIds: optionIdSet,
        implementation,
      },
    },
  }
}

export type CreateResponseStateResult =
  | { ok: true; state: CandidateResponse }
  | { ok: false; issues: readonly ContractIssue[] }

export function createResponseState(
  contract: CompiledResponseContract,
  storedAnswer?: unknown
): CreateResponseStateResult {
  if (storedAnswer !== undefined && storedAnswer !== null) {
    if (!isRecord(storedAnswer)) {
      return responseStateIssue(
        'unsupported_snapshot',
        'The stored answer is not a supported response snapshot.'
      )
    }
    if (storedAnswer.type !== 'ucat_response_v1') {
      return responseStateIssue(
        'unsupported_snapshot',
        'The stored answer is not a supported response snapshot.'
      )
    }
    if (storedAnswer.questionId !== contract.questionId) {
      return responseStateIssue(
        'snapshot_question_mismatch',
        'The stored answer belongs to a different question.'
      )
    }
    if (storedAnswer.answerScheme !== contract.answerSchemeKind) {
      return responseStateIssue(
        'snapshot_scheme_mismatch',
        'The stored answer uses a different Answer scheme.'
      )
    }
    const normalized = normalizeCandidateResponse(contract, storedAnswer.response)
    if (!normalized.ok) return normalized
    return { ok: true, state: normalized.state }
  }

  return {
    ok: true,
    state: contract[compiledContractData].implementation.blankState(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function responseStateIssue(
  code: ContractIssue['code'],
  message: string
): CreateResponseStateResult {
  return {
    ok: false,
    issues: [{ code, path: ['storedAnswer'], message }],
  }
}

function normalizeCandidateResponse(
  contract: CompiledResponseContract,
  value: unknown
): CreateResponseStateResult {
  return contract[compiledContractData].implementation.normalize(contract, value)
}

function normalizeSingleSelectResponse(
  contract: CompiledResponseContract,
  value: unknown
): CreateResponseStateResult {
  if (
    !isRecord(value) ||
    value.kind !== 'single_select' ||
    !(
      value.selectedOptionId === null ||
      typeof value.selectedOptionId === 'string'
    )
  ) {
    return responseStateIssue(
      'unsupported_snapshot',
      'The stored response shape does not match the Answer scheme.'
    )
  }
  if (
    value.selectedOptionId !== null &&
    !contract[compiledContractData].optionIds.has(value.selectedOptionId)
  ) {
    return responseStateIssue(
      'unknown_option',
      'The stored response references an unknown option.'
    )
  }
  return {
    ok: true,
    state: {
      kind: 'single_select',
      selectedOptionId: value.selectedOptionId,
    },
  }
}

function normalizePlacementResponse(
  contract: CompiledResponseContract,
  value: unknown,
  allowedTokens: readonly PlacementValue[],
  reuse: 'unlimited' | 'once_each'
): CreateResponseStateResult {
  if (
    !isRecord(value) ||
    value.kind !== 'placement' ||
    !isRecord(value.placements)
  ) {
    return responseStateIssue(
      'unsupported_snapshot',
      'The stored response shape does not match the Answer scheme.'
    )
  }
  const entries = Object.entries(value.placements)
  if (
    entries.some(
      ([optionId]) => !contract[compiledContractData].optionIds.has(optionId)
    )
  ) {
    return responseStateIssue(
      'unknown_option',
      'The stored response references an unknown placement target.'
    )
  }
  if (
    entries.some(
      ([, token]) =>
        typeof token !== 'string' ||
        !allowedTokens.includes(token as PlacementValue)
    )
  ) {
    return responseStateIssue(
      'unknown_token',
      'The stored response contains an unsupported placement token.'
    )
  }
  const placements = Object.fromEntries(entries) as Record<
    string,
    PlacementValue
  >
  if (
    reuse === 'once_each' &&
    new Set(Object.values(placements)).size !== Object.keys(placements).length
  ) {
    return responseStateIssue(
      'token_reused',
      'Most and Least Appropriate tokens may each be placed only once.'
    )
  }
  return { ok: true, state: { kind: 'placement', placements } }
}

function answerSchemeFor<K extends AnswerScheme['kind']>(
  contract: CompiledResponseContract,
  kind: K
): Extract<AnswerScheme, { kind: K }> {
  const answerScheme = contract[compiledContractData].answerScheme
  if (answerScheme.kind !== kind) {
    throw new Error(`Internal response-contract registry mismatch for ${kind}.`)
  }
  return answerScheme as Extract<AnswerScheme, { kind: K }>
}

type ReviewOutcome = 'correct' | 'partial' | 'incorrect' | 'unanswered'

export type ReviewContract =
  | {
      kind: 'single_select'
      selectedOptionId: string | null
      correctOptionId: string
      outcome: ReviewOutcome
    }
  | {
      kind: 'placement'
      rows: readonly {
        targetId: string
        placedToken: PlacementValue | null
        correctToken: PlacementValue | null
        outcome: 'correct' | 'incorrect' | 'unanswered'
      }[]
      outcome: ReviewOutcome
    }

export type PlacementDestinationReviewRow = {
  token: PlacementValue | null
  label: string
  selectedTargetIds: readonly string[]
  correctTargetIds: readonly string[]
  outcome: 'correct' | 'incorrect' | 'unanswered'
}

/** Inverts target-first review data for options dragged into named destinations. */
export function projectPlacementReviewByDestination(
  presentation: Extract<PresentationContract, { kind: 'placement' }>,
  review: Extract<ReviewContract, { kind: 'placement' }>
): readonly PlacementDestinationReviewRow[] {
  const reviewByTargetId = new Map(review.rows.map((row) => [row.targetId, row]))
  const orderedRows = presentation.targetIds
    .map((targetId) => reviewByTargetId.get(targetId))
    .filter((row) => row !== undefined)

  return [
    ...presentation.tokens.map((token) => ({
      token: token.value,
      label: token.label,
    })),
    { token: null, label: 'Not placed' },
  ].map(({ token, label }) => {
    const selectedTargetIds = orderedRows
      .filter((row) => row.placedToken === token)
      .map((row) => row.targetId)
    const correctTargetIds = orderedRows
      .filter((row) => row.correctToken === token)
      .map((row) => row.targetId)
    const isCorrect =
      selectedTargetIds.length === correctTargetIds.length &&
      selectedTargetIds.every(
        (targetId, index) => targetId === correctTargetIds[index]
      )

    return {
      token,
      label,
      selectedTargetIds,
      correctTargetIds,
      outcome: isCorrect
        ? 'correct'
        : selectedTargetIds.length === 0
          ? 'unanswered'
          : 'incorrect',
    }
  })
}

export type EvaluationResult =
  | { ok: false; issues: readonly ContractIssue[] }
  | {
      ok: true
      response: CandidateResponse
      complete: boolean
      snapshot: ResponseSnapshotV1
      score: { awarded: number; maximum: number }
      review: ReviewContract
    }

function successfulEvaluation(params: {
  contract: CompiledResponseContract
  response: CandidateResponse
  complete: boolean
  awarded: number
  maximum: number
  review: ReviewContract
}): EvaluationResult {
  return {
    ok: true,
    response: params.response,
    complete: params.complete,
    snapshot: {
      type: 'ucat_response_v1',
      questionId: params.contract.questionId,
      answerScheme: params.contract.answerSchemeKind,
      response: params.response,
    },
    score: { awarded: params.awarded, maximum: params.maximum },
    review: params.review,
  }
}

export function evaluateResponse(
  contract: CompiledResponseContract,
  response: CandidateResponse
): EvaluationResult {
  const normalized = normalizeCandidateResponse(contract, response)
  if (!normalized.ok) return normalized
  return contract[compiledContractData].implementation.evaluate(
    contract,
    normalized.state
  )
}

function evaluateSingleSelect(
  contract: CompiledResponseContract,
  response: CandidateResponse,
  partialCreditForSamePolarity: boolean
): EvaluationResult {
  if (response.kind !== 'single_select') return responseKindMismatch()
  const answerScheme = contract[compiledContractData].answerScheme
  if (
    answerScheme.kind !== 'single_choice' &&
    answerScheme.kind !== 'situational_judgement_rating'
  ) {
    throw new Error('Internal single-select registry mismatch.')
  }
  const complete = response.selectedOptionId !== null
  const correct = response.selectedOptionId === answerScheme.correctOptionId
  const selectedIndex = contract.orderedOptionIds.indexOf(
    response.selectedOptionId ?? ''
  )
  const correctIndex = contract.orderedOptionIds.indexOf(
    answerScheme.correctOptionId
  )
  const sameRatingPolarity =
    partialCreditForSamePolarity &&
    selectedIndex >= 0 &&
    correctIndex >= 0 &&
    Math.floor(selectedIndex / 2) === Math.floor(correctIndex / 2)
  const awarded = correct ? 1 : sameRatingPolarity ? 0.5 : 0
  return successfulEvaluation({
    contract,
    response,
    complete,
    awarded,
    maximum: getAnswerSchemeMaximum(answerScheme.kind),
    review: {
      kind: 'single_select',
      selectedOptionId: response.selectedOptionId,
      correctOptionId: answerScheme.correctOptionId,
      outcome: correct
        ? 'correct'
        : sameRatingPolarity
          ? 'partial'
          : complete
            ? 'incorrect'
            : 'unanswered',
    },
  })
}

function evaluateDecisionMakingBinary(
  contract: CompiledResponseContract,
  response: CandidateResponse
): EvaluationResult {
  if (response.kind !== 'placement') return responseKindMismatch()
  const answerScheme = answerSchemeFor(
    contract,
    'decision_making_binary_placement'
  )
  const rows = contract.orderedOptionIds.map((targetId) => {
    const placedToken = response.placements[targetId] ?? null
    const correctToken = answerScheme.correctByOptionId[targetId]
    return {
      targetId,
      placedToken,
      correctToken,
      outcome: (placedToken === null
        ? 'unanswered'
        : placedToken === correctToken
          ? 'correct'
          : 'incorrect') as 'correct' | 'incorrect' | 'unanswered',
    }
  })
  const correctCount = rows.filter((row) => row.outcome === 'correct').length
  const complete = rows.every((row) => row.placedToken !== null)
  const awarded = correctCount === 5 ? 2 : correctCount >= 3 ? 1 : 0
  const outcome: ReviewOutcome =
    !complete && correctCount === 0
      ? 'unanswered'
      : awarded === 2
        ? 'correct'
        : awarded === 1
          ? 'partial'
          : 'incorrect'
  return successfulEvaluation({
    contract,
    response,
    complete,
    awarded,
    maximum: getAnswerSchemeMaximum(answerScheme.kind),
    review: { kind: 'placement', rows, outcome },
  })
}

const provisionalMostLeastScoring = {
  exactDestination: 4,
  middleAction: 2,
  oppositeDestination: 0,
  maximum: 8,
} as const

function evaluateSituationalJudgementMostLeast(
  contract: CompiledResponseContract,
  response: CandidateResponse
): EvaluationResult {
  if (response.kind !== 'placement') return responseKindMismatch()
  const answerScheme = answerSchemeFor(
    contract,
    'situational_judgement_most_least'
  )
  const selectedMostOptionId = Object.entries(response.placements).find(
    ([, placement]) => placement === 'most'
  )?.[0]
  const selectedLeastOptionId = Object.entries(response.placements).find(
    ([, placement]) => placement === 'least'
  )?.[0]
  const complete =
    selectedMostOptionId !== undefined && selectedLeastOptionId !== undefined
  const middleOptionId = contract.orderedOptionIds.find(
    (optionId) =>
      optionId !== answerScheme.mostAppropriateOptionId &&
      optionId !== answerScheme.leastAppropriateOptionId
  )
  const pointsForPlacement = (
    selectedOptionId: string | undefined,
    correctOptionId: string
  ): number => {
    if (selectedOptionId === correctOptionId) {
      return provisionalMostLeastScoring.exactDestination
    }
    if (selectedOptionId === middleOptionId) {
      return provisionalMostLeastScoring.middleAction
    }
    return provisionalMostLeastScoring.oppositeDestination
  }
  const awarded = complete
    ? pointsForPlacement(
        selectedMostOptionId,
        answerScheme.mostAppropriateOptionId
      ) +
      pointsForPlacement(
        selectedLeastOptionId,
        answerScheme.leastAppropriateOptionId
      )
    : 0
  const rows = contract.orderedOptionIds.map((targetId) => {
    const placedToken = response.placements[targetId] ?? null
    const correctToken: PlacementValue | null =
      targetId === answerScheme.mostAppropriateOptionId
        ? 'most'
        : targetId === answerScheme.leastAppropriateOptionId
          ? 'least'
          : null
    return {
      targetId,
      placedToken,
      correctToken,
      outcome: (placedToken === null
        ? 'unanswered'
        : placedToken === correctToken
          ? 'correct'
          : 'incorrect') as 'correct' | 'incorrect' | 'unanswered',
    }
  })
  const outcome: ReviewOutcome = !complete
    ? 'unanswered'
    : awarded === provisionalMostLeastScoring.maximum
      ? 'correct'
      : awarded > 0
        ? 'partial'
        : 'incorrect'
  return successfulEvaluation({
    contract,
    response,
    complete,
    awarded,
    maximum: getAnswerSchemeMaximum(answerScheme.kind),
    review: { kind: 'placement', rows, outcome },
  })
}

function responseKindMismatch(): EvaluationResult {
  return {
    ok: false,
    issues: [
      {
        code: 'response_kind_mismatch',
        path: ['response', 'kind'],
        message: 'The response shape does not match the Answer scheme.',
      },
    ],
  }
}

function validateChoiceAnswerKey(
  answerScheme: AnswerScheme,
  _orderedOptionIds: readonly string[],
  optionIds: ReadonlySet<string>,
  addIssue: AddContractIssue
): void {
  if (
    answerScheme.kind !== 'single_choice' &&
    answerScheme.kind !== 'situational_judgement_rating'
  ) {
    throw new Error('Internal choice Answer-scheme registry mismatch.')
  }
  if (!optionIds.has(answerScheme.correctOptionId)) {
    addIssue(
      'unknown_key_option',
      ['answerScheme'],
      'The answer key references an unknown option.'
    )
  }
}

function validateBinaryAnswerKey(
  answerScheme: AnswerScheme,
  orderedOptionIds: readonly string[],
  optionIds: ReadonlySet<string>,
  addIssue: AddContractIssue
): void {
  if (answerScheme.kind !== 'decision_making_binary_placement') {
    throw new Error('Internal DM Answer-scheme registry mismatch.')
  }
  const keyIds = Object.keys(answerScheme.correctByOptionId)
  if (
    orderedOptionIds.some(
      (optionId) => !(optionId in answerScheme.correctByOptionId)
    )
  ) {
    addIssue(
      'missing_key_option',
      ['answerScheme', 'correctByOptionId'],
      'Every placement target requires an answer key.'
    )
  }
  if (keyIds.some((optionId) => !optionIds.has(optionId))) {
    addIssue(
      'unknown_key_option',
      ['answerScheme', 'correctByOptionId'],
      'The answer key references an unknown option.'
    )
  }
}

function validateMostLeastAnswerKey(
  answerScheme: AnswerScheme,
  _orderedOptionIds: readonly string[],
  optionIds: ReadonlySet<string>,
  addIssue: AddContractIssue
): void {
  if (answerScheme.kind !== 'situational_judgement_most_least') {
    throw new Error('Internal Most/Least Answer-scheme registry mismatch.')
  }
  if (
    !optionIds.has(answerScheme.mostAppropriateOptionId) ||
    !optionIds.has(answerScheme.leastAppropriateOptionId)
  ) {
    addIssue(
      'unknown_key_option',
      ['answerScheme'],
      'The answer key references an unknown option.'
    )
  }
  if (
    answerScheme.mostAppropriateOptionId ===
    answerScheme.leastAppropriateOptionId
  ) {
    addIssue(
      'same_most_and_least_option',
      ['answerScheme'],
      'Most and Least Appropriate must be different actions.'
    )
  }
}

const choicePresentation = (
  orderedOptionIds: readonly string[]
): PresentationContract => ({
  kind: 'single_select',
  optionIds: orderedOptionIds,
})

const blankSingleSelect = (): CandidateResponse => ({
  kind: 'single_select',
  selectedOptionId: null,
})

const blankPlacement = (): CandidateResponse => ({
  kind: 'placement',
  placements: {},
})

const schemeImplementations: Record<
  AnswerScheme['kind'],
  SchemeImplementation
> = {
  single_choice: {
    responseType: 'multiple_choice',
    optionCount: { minimum: 2 },
    maximumMarks: 1,
    progressPoints: 1,
    validateAnswerKey: validateChoiceAnswerKey,
    presentation: choicePresentation,
    blankState: blankSingleSelect,
    normalize: normalizeSingleSelectResponse,
    evaluate: (contract, response) =>
      evaluateSingleSelect(contract, response, false),
  },
  situational_judgement_rating: {
    responseType: 'multiple_choice',
    optionCount: 4,
    maximumMarks: 1,
    progressPoints: 1,
    validateAnswerKey: validateChoiceAnswerKey,
    presentation: choicePresentation,
    blankState: blankSingleSelect,
    normalize: normalizeSingleSelectResponse,
    evaluate: (contract, response) =>
      evaluateSingleSelect(contract, response, true),
  },
  decision_making_binary_placement: {
    responseType: 'drag_and_drop',
    optionCount: 5,
    maximumMarks: 2,
    progressPoints: 2,
    validateAnswerKey: validateBinaryAnswerKey,
    presentation: (orderedOptionIds) => ({
      kind: 'placement',
      targetIds: orderedOptionIds,
      tokens: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
      reuse: 'unlimited',
      requiredPlacements: 5,
      dragDirection: 'tokens_to_options',
    }),
    blankState: blankPlacement,
    normalize: (contract, value) =>
      normalizePlacementResponse(contract, value, ['yes', 'no'], 'unlimited'),
    evaluate: evaluateDecisionMakingBinary,
  },
  situational_judgement_most_least: {
    responseType: 'drag_and_drop',
    optionCount: 3,
    maximumMarks: provisionalMostLeastScoring.maximum,
    progressPoints: 1,
    validateAnswerKey: validateMostLeastAnswerKey,
    presentation: (orderedOptionIds) => ({
      kind: 'placement',
      targetIds: orderedOptionIds,
      tokens: [
        { value: 'most', label: 'Most Appropriate' },
        { value: 'least', label: 'Least Appropriate' },
      ],
      reuse: 'once_each',
      requiredPlacements: 2,
      displayColumnsOverride: 1,
      dragDirection: 'options_to_tokens',
    }),
    blankState: blankPlacement,
    normalize: (contract, value) =>
      normalizePlacementResponse(
        contract,
        value,
        ['most', 'least'],
        'once_each'
      ),
    evaluate: evaluateSituationalJudgementMostLeast,
  },
}

export function getAnswerSchemeMaximum(kind: AnswerScheme['kind']): number {
  return schemeImplementations[kind].maximumMarks
}

export function getAnswerSchemeProgressPoints(
  kind: AnswerScheme['kind']
): number {
  return schemeImplementations[kind].progressPoints
}

export function getAnswerSchemeContract(
  kind: AnswerScheme['kind']
): AnswerSchemeContract {
  const implementation = schemeImplementations[kind]
  return {
    responseType: implementation.responseType,
    optionCount:
      typeof implementation.optionCount === 'number'
        ? implementation.optionCount
        : { minimum: implementation.optionCount.minimum },
  }
}

/** Presentation semantics owned by the scheme registry, independent of answer keys. */
export function getAnswerSchemePresentation(
  kind: AnswerScheme['kind'],
  orderedOptionIds: readonly string[]
): PresentationContract {
  return schemeImplementations[kind].presentation(orderedOptionIds)
}

export function resolveAnswerSchemeDisplayColumns(
  kind: AnswerScheme['kind'],
  sectionDefault: 1 | 2
): 1 | 2 {
  const presentation = getAnswerSchemePresentation(kind, [])
  return presentation.kind === 'placement'
    ? (presentation.displayColumnsOverride ?? sectionDefault)
    : sectionDefault
}

export function tryGetPlacementPresentation(
  kind: unknown,
  orderedOptionIds: readonly string[]
): Extract<PresentationContract, { kind: 'placement' }> | null {
  if (
    typeof kind !== 'string' ||
    !Object.prototype.hasOwnProperty.call(schemeImplementations, kind)
  ) {
    return null
  }
  const presentation = schemeImplementations[
    kind as AnswerScheme['kind']
  ].presentation(orderedOptionIds)
  return presentation.kind === 'placement' ? presentation : null
}

export function applyPlacementTransition(params: {
  presentation: Extract<PresentationContract, { kind: 'placement' }>
  placements: Readonly<Record<string, PlacementValue>>
  targetId: string
  token: PlacementValue
  sourceId?: string | null
}): Readonly<Record<string, PlacementValue>> {
  if (!params.presentation.targetIds.includes(params.targetId)) {
    throw new Error('The placement target is not part of this response.')
  }
  if (!params.presentation.tokens.some((token) => token.value === params.token)) {
    throw new Error('The placement token is not part of this response.')
  }
  const next = { ...params.placements }
  if (params.sourceId && params.sourceId !== params.targetId) {
    delete next[params.sourceId]
  }
  if (params.presentation.reuse === 'once_each') {
    for (const [targetId, token] of Object.entries(next)) {
      if (token === params.token && targetId !== params.targetId) {
        delete next[targetId]
      }
    }
  }
  next[params.targetId] = params.token
  return next
}
