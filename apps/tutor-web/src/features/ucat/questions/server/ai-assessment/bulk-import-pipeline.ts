import type {
  BlindSolutionResponse,
  BulkImportRepairResponse,
  UcatAssessmentPatch,
  UcatAssessmentResponse,
} from '@/features/ucat/questions/lib/ai-assessment/schema'
import { applyUcatAssessmentPatches } from '@/features/ucat/questions/lib/ai-assessment/apply-patches'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { BULK_IMPORT_AUTO_APPLY_CONFIDENCE } from '@/features/ucat/questions/lib/bulk-import-review-policy'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export const BULK_IMPORT_AI_CALL_OPTIONS = {
  blind: {
    maxCompletionTokens: 3_000,
    timeoutMs: 120_000,
    reasoningEffort: 'low',
  },
  auditRepair: {
    maxCompletionTokens: 6_000,
    timeoutMs: 180_000,
    reasoningEffort: 'low',
  },
} as const

export const BULK_IMPORT_AUDIT_QUESTION_CHUNK_SIZE = 3

export function chunkBulkImportAuditQuestionIds(questionIds: string[]): string[][] {
  const chunks: string[][] = []
  for (let index = 0; index < questionIds.length; index += BULK_IMPORT_AUDIT_QUESTION_CHUNK_SIZE) {
    chunks.push(questionIds.slice(index, index + BULK_IMPORT_AUDIT_QUESTION_CHUNK_SIZE))
  }
  return chunks
}

export function deriveBulkImportAssessment(params: {
  audit: UcatAssessmentResponse
  repair: BulkImportRepairResponse
}): UcatAssessmentResponse {
  const repairByFindingKey = new Map(
    params.repair.repairs.flatMap((repair) =>
      repair.resolvedFindingKeys.map((key) => [key, repair] as const)
    )
  )
  const resolvedFindingKeys = new Set(repairByFindingKey.keys())
  const unresolvedByKey = new Map(
    params.repair.unresolvedFindings.map((finding) => [finding.key, finding])
  )
  const findings: UcatAssessmentResponse['findings'] = [
    ...params.audit.findings.filter(
      (finding) => !resolvedFindingKeys.has(finding.key) && !unresolvedByKey.has(finding.key)
    ),
    ...params.repair.unresolvedFindings,
  ]
  const sameCategoryScope = (
    left: UcatAssessmentResponse['categories'][number],
    right: Pick<UcatAssessmentResponse['findings'][number], 'scopeType' | 'questionId' | 'category'>,
  ) => left.scopeType === right.scopeType
    && (left.questionId ?? null) === (right.questionId ?? null)
    && left.category === right.category

  const categories = params.audit.categories.map((category) => {
    if (findings.some((finding) => sameCategoryScope(category, finding))) return category
    const resolved = params.audit.findings.filter(
      (finding) => resolvedFindingKeys.has(finding.key) && sameCategoryScope(category, finding)
    )
    if (resolved.length === 0) return category
    const repairs = resolved.flatMap((finding) => {
      const repair = repairByFindingKey.get(finding.key)
      return repair ? [repair] : []
    })
    return {
      ...category,
      rating: 'pass' as const,
      confidence: Math.max(...repairs.map((repair) => repair.confidence)),
      summary: `Resolved by AI repair: ${[...new Set(repairs.map((repair) => repair.summary))].join(' ')}`,
      evidence: [],
    }
  })

  return {
    overallSummary: params.repair.overallSummary,
    categories,
    findings,
  }
}

export function automaticBulkAnswerRepairAgreesWithBlind(
  patch: UcatAssessmentPatch,
  blindSolution: BlindSolutionResponse,
): boolean {
  if (patch.operation !== 'set_answer_key' && patch.operation !== 'replace_option_and_key') {
    return true
  }
  const solution = blindSolution.solutions.find(
    (item) => item.questionId === patch.questionId
  )
  const repairedCorrectOptionId = patch.operation === 'set_answer_key'
    ? patch.correctOptionId
    : patch.optionId
  return Boolean(
    solution
    && !solution.ambiguous
    && !solution.unsolvable
    && solution.confidence >= 0.95
    && solution.selectedOptionId === repairedCorrectOptionId
  )
}

export function automaticBulkRepairPatchAllowed(patch: UcatAssessmentPatch): boolean {
  if (
    patch.operation === 'replace_question'
    || patch.operation === 'insert_question'
    || patch.operation === 'remove_question'
    || patch.operation === 'update_visual_spec'
    || patch.operation === 'replace_option_and_key'
    || patch.operation === 'insert_option'
    || patch.operation === 'remove_option'
  ) return false
  if (patch.operation === 'replace_text') {
    const semanticCharacters = (value: string) =>
      value.normalize('NFC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
    return semanticCharacters(patch.beforeText) === semanticCharacters(patch.afterText)
  }
  if (patch.operation === 'set_rich_content') {
    const semanticCharacters = (value: string) =>
      value.normalize('NFC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
    return semanticCharacters(proseMirrorToPlainText(patch.before))
      === semanticCharacters(proseMirrorToPlainText(patch.after))
  }
  if (patch.operation === 'set_text') {
    return patch.target.field === 'answer_explanation'
  }
  if (patch.operation === 'set_metadata') {
    return patch.field === 'difficulty'
      || patch.field === 'time_burden_seconds'
      || patch.field === 'tag_ids'
  }
  return true
}

export function blindQuestionIdsRequiredForReview(params: {
  audit: UcatAssessmentResponse
  repair: BulkImportRepairResponse
}): string[] {
  const questionIds = new Set<string>()
  for (const finding of params.audit.findings) {
    if (finding.category === 'answer_correctness_fairness' && finding.questionId) {
      questionIds.add(finding.questionId)
    }
  }
  for (const repair of params.repair.repairs) {
    for (const patch of repair.patches) {
      if (patch.operation === 'set_answer_key' || patch.operation === 'replace_option_and_key') {
        questionIds.add(patch.questionId)
      }
    }
  }
  return [...questionIds]
}

/** Builds the single post-repair candidate used to verify both key and semantic edits. */
export async function prepareBulkImportVerificationCandidate(params: {
  values: UcatQuestionStemFormValues
  audit: UcatAssessmentResponse
  repair: BulkImportRepairResponse
}): Promise<{ values: UcatQuestionStemFormValues; questionIds: string[] }> {
  let values = params.values
  const questionIds = new Set(blindQuestionIdsRequiredForReview(params))
  for (const repair of params.repair.repairs) {
    if (repair.confidence < BULK_IMPORT_AUTO_APPLY_CONFIDENCE) continue
    for (const patch of repair.patches) {
      const questionId = patch.operation === 'set_answer_key'
        ? patch.questionId
        : (!automaticBulkRepairPatchAllowed(patch)
          ? semanticRepairQuestionId(values, patch)
          : null)
      if (!questionId) continue
      try {
        values = await applyUcatAssessmentPatches(values, [patch])
        questionIds.add(questionId)
      } catch {
        // Reconciliation reports patch application failures with full context.
      }
    }
  }
  return { values, questionIds: [...questionIds] }
}

export async function runConditionalBulkImportReview<TAuditRepair extends {
  response: {
    audit: UcatAssessmentResponse
    repair: BulkImportRepairResponse
  }
}, TBlind>(operations: {
  auditAndRepair: () => Promise<TAuditRepair>
  blindSolve: (questionIds: string[]) => Promise<TBlind>
}): Promise<{
  auditRepair: TAuditRepair
  blindSolution: TBlind | null
  blindQuestionIds: string[]
}> {
  const auditRepair = await operations.auditAndRepair()
  const blindQuestionIds = blindQuestionIdsRequiredForReview(auditRepair.response)
  const blindSolution = blindQuestionIds.length > 0
    ? await operations.blindSolve(blindQuestionIds)
    : null
  return { auditRepair, blindSolution, blindQuestionIds }
}

function blindDisagreementDetail(params: {
  values: UcatQuestionStemFormValues
  patch: UcatAssessmentPatch
  blindSolution: BlindSolutionResponse
}): string | null {
  if (params.patch.operation !== 'set_answer_key'
    && params.patch.operation !== 'replace_option_and_key') return null
  const patch = params.patch
  const solution = params.blindSolution.solutions.find(
    (item) => item.questionId === patch.questionId
  )
  if (!solution) return 'The independent blind solver did not return a result for this question.'
  if (solution.unsolvable) {
    return `The independent blind solver considered this question unsolvable: ${solution.justification}`
  }
  if (solution.ambiguous) {
    return `The independent blind solver considered this question ambiguous: ${solution.justification}`
  }
  if (solution.confidence < 0.95) {
    return `The independent blind solver was not confident enough to authorize an answer-key change (${Math.round(solution.confidence * 100)}% confidence).`
  }
  const question = params.values.questions.find(
    (item) => item.id === patch.questionId
  )
  const selectedOption = question?.options.find(
    (option) => option.id === solution.selectedOptionId
  )
  const selectedLabel = selectedOption
    ? proseMirrorToPlainText(selectedOption.answerText).trim()
    : solution.proposedAnswer?.trim() || solution.selectedOptionId || 'a different answer'
  return `The independent blind solver selected “${selectedLabel}” instead: ${solution.justification}`
}

function unresolvedRepairFinding(params: {
  audit: UcatAssessmentResponse
  repair: BulkImportRepairResponse['repairs'][number]
  detail: string
  patches?: UcatAssessmentPatch[]
}): UcatAssessmentResponse['findings'][number] {
  const auditFinding = params.repair.resolvedFindingKeys
    .flatMap((key) => params.audit.findings.find((finding) => finding.key === key) ?? [])
    .at(0)
  const patches = params.patches ?? params.repair.patches
  const suggestion = patches.length > 0 && patches.length <= 8
    ? {
        id: `repair-approval:${params.repair.summary}`,
        summary: params.repair.summary,
        rationale: params.repair.rationale,
        application: 'approval_required' as const,
        patches,
      }
    : null
  return auditFinding
    ? {
        ...auditFinding,
        detail: params.detail,
        recommendedAction: suggestion ? 'fix' : 'review',
        suggestion,
      }
    : {
        key: `repair-rejected:${params.repair.summary}`,
        scopeType: 'shared',
        questionId: null,
        category: 'presentation_integrity',
        rating: 'concern',
        confidence: params.repair.confidence,
        title: `Could not apply: ${params.repair.summary}`,
        detail: params.detail,
        evidence: [],
        recommendedAction: suggestion ? 'fix' : 'review',
        suggestion,
      }
}

function semanticRepairQuestionId(
  values: UcatQuestionStemFormValues,
  patch: UcatAssessmentPatch,
): string | null {
  if (
    patch.operation === 'replace_option_and_key'
    || patch.operation === 'insert_option'
    || patch.operation === 'remove_option'
  ) return patch.questionId
  if (
    (
      patch.operation === 'replace_text'
      || patch.operation === 'set_text'
      || patch.operation === 'set_rich_content'
    )
    && patch.target.id
  ) {
    if (patch.target.kind === 'question') return patch.target.id
    if (patch.target.kind === 'option') {
      return values.questions.find(
        (question) => question.options.some((option) => option.id === patch.target.id)
      )?.id ?? null
    }
  }
  return null
}

function blindSolutionAgreesWithQuestion(params: {
  values: UcatQuestionStemFormValues
  questionId: string
  blindSolution: BlindSolutionResponse
}): boolean {
  const question = params.values.questions.find((item) => item.id === params.questionId)
  const solution = params.blindSolution.solutions.find(
    (item) => item.questionId === params.questionId
  )
  if (
    !question
    || !solution
    || solution.ambiguous
    || solution.unsolvable
    || solution.confidence < 0.95
  ) return false
  if (question.questionType === 'multiple_choice') {
    const keyedOptionId = question.options.find((option) => option.isAnswer)?.id ?? null
    return Boolean(keyedOptionId && solution.selectedOptionId === keyedOptionId)
  }
  const answersByOptionId = new Map(
    solution.syllogismAnswers.map((answer) => [answer.optionId, answer.answer])
  )
  return question.options.length > 0 && question.options.every(
    (option) => answersByOptionId.get(option.id as string) === (option.isAnswer ? 'yes' : 'no')
  )
}

function targetedBlindDisagreementDetail(params: {
  values: UcatQuestionStemFormValues
  questionId: string
  blindSolution: BlindSolutionResponse
}): string {
  const question = params.values.questions.find((item) => item.id === params.questionId)
  const solution = params.blindSolution.solutions.find(
    (item) => item.questionId === params.questionId
  )
  if (!solution) return 'Targeted blind verification returned no result for the repaired question.'
  if (solution.unsolvable) {
    return `Targeted blind verification considered the repaired question unsolvable: ${solution.justification}`
  }
  if (solution.ambiguous) {
    return `Targeted blind verification considered the repaired question ambiguous: ${solution.justification}`
  }
  if (solution.confidence < 0.95) {
    return `Targeted blind verification was not confident enough to authorize the semantic repair (${Math.round(solution.confidence * 100)}% confidence).`
  }
  const selectedOption = question?.options.find(
    (option) => option.id === solution.selectedOptionId
  )
  const selectedLabel = selectedOption
    ? proseMirrorToPlainText(selectedOption.answerText).trim()
    : solution.proposedAnswer?.trim() || solution.selectedOptionId || 'a different answer'
  const keyedOption = question?.options.find((option) => option.isAnswer)
  const keyedLabel = keyedOption
    ? proseMirrorToPlainText(keyedOption.answerText).trim()
    : 'the repaired key'
  return `Targeted blind verification selected “${selectedLabel}” instead of “${keyedLabel}”: ${solution.justification}`
}

export async function reconcileBulkImportAiReview(params: {
  values: UcatQuestionStemFormValues
  blindSolution: BlindSolutionResponse
  audit: UcatAssessmentResponse
  repair: BulkImportRepairResponse
  preverifiedSemanticBlindSolution?: BlindSolutionResponse
  verifySemanticRepair?: (input: {
    values: UcatQuestionStemFormValues
    questionIds: string[]
  }) => Promise<BlindSolutionResponse>
}): Promise<{
  values: UcatQuestionStemFormValues
  assessment: UcatAssessmentResponse
  appliedRepairs: string[]
  blindSolution: BlindSolutionResponse
}> {
  type RepairState = {
    repair: BulkImportRepairResponse['repairs'][number]
    acceptedPatches: UcatAssessmentPatch[]
    semanticPatches: Array<{ patch: UcatAssessmentPatch; questionId: string }>
    approvalPatches: UcatAssessmentPatch[]
    rejectionDetails: string[]
    verifiedCurrentAnswerKey: boolean
  }

  let safeValues = params.values
  const repairStates: RepairState[] = []
  const acceptedRepairs: BulkImportRepairResponse['repairs'] = []
  const unresolvedFindings = [...params.repair.unresolvedFindings]
  const appliedRepairs: string[] = []

  for (const repair of params.repair.repairs) {
    const state: RepairState = {
      repair,
      acceptedPatches: [],
      semanticPatches: [],
      approvalPatches: [],
      rejectionDetails: [],
      verifiedCurrentAnswerKey: false,
    }

    if (repair.confidence < BULK_IMPORT_AUTO_APPLY_CONFIDENCE) {
      state.approvalPatches.push(...repair.patches)
      state.rejectionDetails.push(
        `AI confidence was ${Math.round(repair.confidence * 100)}%; automatic fixes require ${Math.round(BULK_IMPORT_AUTO_APPLY_CONFIDENCE * 100)}%.`
      )
      repairStates.push(state)
      continue
    }

    for (const patch of repair.patches) {
      if (patch.operation === 'set_answer_key') {
        if (automaticBulkAnswerRepairAgreesWithBlind(patch, params.blindSolution)) {
          try {
            safeValues = await applyUcatAssessmentPatches(safeValues, [patch])
            state.acceptedPatches.push(patch)
          } catch (error) {
            state.rejectionDetails.push(error instanceof Error
              ? error.message
              : 'The agreed answer-key repair could not be applied safely.')
          }
        } else {
          const currentKeyWasVerified = blindSolutionAgreesWithQuestion({
            values: safeValues,
            questionId: patch.questionId,
            blindSolution: params.blindSolution,
          })
          if (currentKeyWasVerified) {
            state.verifiedCurrentAnswerKey = true
          } else {
            state.approvalPatches.push(patch)
            state.rejectionDetails.push(
              blindDisagreementDetail({
                values: safeValues,
                patch,
                blindSolution: params.blindSolution,
              }) ?? 'The proposed answer-key repair did not agree with the independent blind solve.'
            )
          }
        }
        continue
      }
      if (!automaticBulkRepairPatchAllowed(patch)) {
        const questionId = semanticRepairQuestionId(safeValues, patch)
        if (questionId) {
          state.semanticPatches.push({ patch, questionId })
        } else {
          state.approvalPatches.push(patch)
          state.rejectionDetails.push(
            patch.operation === 'set_rich_content'
              ? 'This structured-content repair is ready for tutor approval.'
              : 'This repair requires an unsupported destructive, whole-question, shared-stem, or visual edit.'
          )
        }
        continue
      }
      if (!automaticBulkAnswerRepairAgreesWithBlind(patch, params.blindSolution)) {
        state.rejectionDetails.push(blindDisagreementDetail({
          values: safeValues,
          patch,
          blindSolution: params.blindSolution,
        }) ?? 'The proposed answer-key repair did not agree with the independent blind solve.')
        continue
      }
      try {
        safeValues = await applyUcatAssessmentPatches(safeValues, [patch])
        state.acceptedPatches.push(patch)
      } catch (error) {
        state.rejectionDetails.push(error instanceof Error
          ? error.message
          : 'The proposed repair could not be applied safely.')
      }
    }
    repairStates.push(state)
  }

  let candidateValues = safeValues
  const semanticByQuestionId = new Map<string, Array<{
    state: RepairState
    patch: UcatAssessmentPatch
  }>>()
  for (const state of repairStates) {
    for (const semantic of state.semanticPatches) {
      try {
        candidateValues = await applyUcatAssessmentPatches(candidateValues, [semantic.patch])
        const existing = semanticByQuestionId.get(semantic.questionId) ?? []
        existing.push({ state, patch: semantic.patch })
        semanticByQuestionId.set(semantic.questionId, existing)
      } catch (error) {
        state.rejectionDetails.push(error instanceof Error
          ? error.message
          : 'The proposed semantic repair could not be applied safely.')
      }
    }
  }

  let verifiedBlindSolution: BlindSolutionResponse | null = params.preverifiedSemanticBlindSolution ?? null
  let semanticVerificationFailure: string | null = null
  const semanticQuestionIds = [...semanticByQuestionId.keys()]
  if (semanticQuestionIds.length > 0 && !verifiedBlindSolution && params.verifySemanticRepair) {
    try {
      verifiedBlindSolution = await params.verifySemanticRepair({
        values: candidateValues,
        questionIds: semanticQuestionIds,
      })
    } catch (error) {
      semanticVerificationFailure = error instanceof Error
        ? `Targeted blind verification failed: ${error.message}`
        : 'Targeted blind verification failed.'
    }
  }

  let values = safeValues
  const acceptedSemanticQuestionIds = new Set<string>()
  for (const [questionId, entries] of semanticByQuestionId) {
    const verified = verifiedBlindSolution && blindSolutionAgreesWithQuestion({
      values: candidateValues,
      questionId,
      blindSolution: verifiedBlindSolution,
    })
    if (!verified) {
      const detail = semanticVerificationFailure
        ?? (verifiedBlindSolution
          ? targetedBlindDisagreementDetail({
            values: candidateValues,
            questionId,
            blindSolution: verifiedBlindSolution,
          })
          : 'This semantic repair requires targeted blind verification before it can be applied automatically.')
      for (const { state } of entries) state.rejectionDetails.push(detail)
      continue
    }
    let nextValues = values
    const applied: Array<{ state: RepairState; patch: UcatAssessmentPatch }> = []
    let applicationError: string | null = null
    for (const { state, patch } of entries) {
      try {
        nextValues = await applyUcatAssessmentPatches(nextValues, [patch])
        applied.push({ state, patch })
      } catch (error) {
        applicationError = error instanceof Error
          ? error.message
          : 'The verified semantic repair could not be applied safely.'
        break
      }
    }
    if (applicationError) {
      for (const { state } of entries) state.rejectionDetails.push(applicationError)
      continue
    }
    values = nextValues
    acceptedSemanticQuestionIds.add(questionId)
    for (const { state, patch } of applied) state.acceptedPatches.push(patch)
  }

  for (const state of repairStates) {
    const rejectionDetail = [...new Set(state.rejectionDetails)].join(' ')
    if (state.verifiedCurrentAnswerKey && !rejectionDetail) {
      acceptedRepairs.push({
        ...state.repair,
        summary: 'Independent verification confirmed the current answer key.',
        rationale: 'The blind solver confidently selected the option that is already keyed.',
        patches: [],
      })
    }
    if (state.acceptedPatches.length > 0) {
      appliedRepairs.push(state.repair.summary)
      acceptedRepairs.push({
        ...state.repair,
        patches: state.acceptedPatches,
        resolvedFindingKeys:
          rejectionDetail || state.acceptedPatches.length !== state.repair.patches.length
            ? []
            : state.repair.resolvedFindingKeys,
      })
    }
    if (rejectionDetail) {
      unresolvedFindings.push(unresolvedRepairFinding({
        audit: params.audit,
        repair: state.repair,
        detail: rejectionDetail,
        patches: state.approvalPatches.length > 0
          ? state.approvalPatches
          : state.repair.patches.filter((patch) => !state.acceptedPatches.includes(patch)),
      }))
    }
  }

  const repair = {
    ...params.repair,
    repairs: acceptedRepairs,
    unresolvedFindings,
  }
  const blindSolution = verifiedBlindSolution && acceptedSemanticQuestionIds.size > 0
    ? {
        solutions: [
          ...params.blindSolution.solutions.filter(
            (solution) => !acceptedSemanticQuestionIds.has(solution.questionId)
          ),
          ...verifiedBlindSolution.solutions.filter(
            (solution) => acceptedSemanticQuestionIds.has(solution.questionId)
          ),
        ],
      }
    : params.blindSolution
  return {
    values,
    assessment: deriveBulkImportAssessment({ audit: params.audit, repair }),
    appliedRepairs,
    blindSolution,
  }
}
