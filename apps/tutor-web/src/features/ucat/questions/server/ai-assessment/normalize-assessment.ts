import type { UcatAssessmentResponse } from '@/features/ucat/questions/lib/ai-assessment/schema'

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
