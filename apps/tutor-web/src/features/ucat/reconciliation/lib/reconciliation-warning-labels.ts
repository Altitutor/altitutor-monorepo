import type { ReconciliationData } from '@/features/ucat/reconciliation/api/reconciliation'

export function getStemReconciliationWarnings(
  data: ReconciliationData | undefined,
  stemId: string | null,
): string[] {
  if (!data || !stemId) return []
  const warnings: string[] = []
  if (data.stemsWithNoCategory.some((stem) => stem.id === stemId)) warnings.push('Missing category')
  const missingExplanationCount = data.questionsWithNoExplanation.filter((question) => question.stemId === stemId).length
  if (missingExplanationCount > 0) {
    warnings.push(`${missingExplanationCount} missing explanation${missingExplanationCount === 1 ? '' : 's'}`)
  }
  const missingTagCount = data.untaggedQuestions.filter((question) => question.stemId === stemId).length
  if (missingTagCount > 0) warnings.push(`${missingTagCount} untagged question${missingTagCount === 1 ? '' : 's'}`)
  if (data.privateStemsNotInSet.some((stem) => stem.id === stemId)) warnings.push('Unused private stem')
  if (data.stemsInMultipleSets.some((stem) => stem.id === stemId)) warnings.push('In multiple sets')
  if (
    data.potentialDuplicatePairs.some(
      (pair) => pair.stemA.id === stemId || pair.stemB.id === stemId,
    )
  ) {
    warnings.push('Potential duplicate')
  }
  return warnings
}

export function getSetReconciliationWarnings(
  data: ReconciliationData | undefined,
  setId: string | null,
): string[] {
  if (!data || !setId) return []
  const warnings: string[] = []
  if (data.setsWithIncorrectQuestionCount.some((set) => set.id === setId)) warnings.push('Incorrect question count')
  if (data.setsWithIncorrectTiming.some((set) => set.id === setId)) warnings.push('Incorrect timing')
  if (data.setsWithMultipleSections.some((set) => set.id === setId)) warnings.push('Multiple sections')
  return warnings
}

export function getMockReconciliationWarnings(
  data: ReconciliationData | undefined,
  mockId: string | null,
): string[] {
  if (!data || !mockId) return []
  if (data.mocksWithIncorrectSets.some((mock) => mock.id === mockId)) {
    return ['Incorrect set count or order']
  }
  return []
}
