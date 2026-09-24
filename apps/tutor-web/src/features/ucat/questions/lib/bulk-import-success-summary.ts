type ImportedStemStatus = 'draft' | 'in_review'

export function bulkImportSuccessSummary(params: {
  questionCount: number
  statuses: Record<string, ImportedStemStatus>
}) {
  const importedStatuses = Object.values(params.statuses)
  const stemCount = importedStatuses.length
  const inReviewCount = importedStatuses.filter((status) => status === 'in_review').length
  const draftCount = importedStatuses.filter((status) => status === 'draft').length
  return {
    title: `${stemCount} ${stemCount === 1 ? 'stem' : 'stems'} imported (${params.questionCount} ${params.questionCount === 1 ? 'question' : 'questions'})`,
    description: `${inReviewCount} In review · ${draftCount} Draft`,
  }
}
