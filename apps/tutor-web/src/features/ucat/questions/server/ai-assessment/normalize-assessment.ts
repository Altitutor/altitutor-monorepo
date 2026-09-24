import type {
  UcatAssessmentPatch,
  UcatAssessmentResponse,
  UcatAssessmentSnapshot,
} from '@/features/ucat/questions/lib/ai-assessment/schema'

/**
 * Finding keys are model-authored UI identifiers, not content-duplicate signals.
 * Preserve the first occurrence and make later collisions unique and stable enough
 * for decisions within the same assessment run.
 */
export function normalizeDuplicateAssessmentFindingKeys(
  assessment: UcatAssessmentResponse,
): UcatAssessmentResponse {
  const used = new Set<string>()
  const findings = assessment.findings.map((finding) => {
    if (!used.has(finding.key)) {
      used.add(finding.key)
      return finding
    }

    const scope = finding.scopeType === 'question'
      ? finding.questionId ?? 'unknown-question'
      : 'shared'
    const base = `${finding.key}:${scope}:${finding.category}`
    let key = base
    let suffix = 2
    while (used.has(key)) {
      key = `${base}:${suffix}`
      suffix += 1
    }
    used.add(key)
    return { ...finding, key }
  })

  return { ...assessment, findings }
}

function snapshotPlainForTextTarget(
  snapshot: UcatAssessmentSnapshot,
  target: Extract<UcatAssessmentPatch, { operation: 'set_text' }>['target'],
): string | null | undefined {
  if (target.kind === 'stem') {
    if (target.field !== 'stem_text') return undefined
    return snapshot.stemTextPlain.trim() || null
  }
  if (target.kind === 'question' && target.id) {
    const question = snapshot.questions.find((item) => item.id === target.id)
    if (!question) return undefined
    if (target.field === 'question_text') return question.questionTextPlain.trim() || null
    if (target.field === 'answer_explanation') return question.answerExplanationPlain.trim() || null
    return undefined
  }
  if (target.kind === 'option' && target.id) {
    const option = snapshot.questions
      .flatMap((question) => question.options)
      .find((item) => item.id === target.id)
    if (!option) return undefined
    if (target.field === 'answer_text') return option.answerTextPlain.trim() || null
    if (target.field === 'answer_explanation') return option.answerExplanationPlain.trim() || null
  }
  return undefined
}

/**
 * Models often emit set_text with beforeText=null even when the field already has
 * content. Bind the optimistic-concurrency baseline to the reviewed snapshot so
 * Accept works unless the tutor actually changed the field afterwards.
 */
export function bindAssessmentSetTextBeforesToSnapshot(
  assessment: UcatAssessmentResponse,
  snapshot: UcatAssessmentSnapshot,
): UcatAssessmentResponse {
  return {
    ...assessment,
    findings: assessment.findings.map((finding) => {
      if (!finding.suggestion) return finding
      return {
        ...finding,
        suggestion: {
          ...finding.suggestion,
          patches: finding.suggestion.patches.map((patch) => {
            if (patch.operation !== 'set_text') return patch
            const actual = snapshotPlainForTextTarget(snapshot, patch.target)
            if (actual === undefined) return patch
            return { ...patch, beforeText: actual }
          }),
        },
      }
    }),
  }
}

