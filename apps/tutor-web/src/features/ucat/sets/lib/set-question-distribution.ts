export type SetQuestionDistributionRow = {
  label: string
  count: number
}

export type SetQuestionDistributionInput = {
  categoryName?: string | null
  questions: Array<{
    tags?: Array<{ name?: string | null }> | null
  }>
}

function sortDistribution(rows: SetQuestionDistributionRow[]): SetQuestionDistributionRow[] {
  return [...rows].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

export function buildSetQuestionDistributions(details: SetQuestionDistributionInput[]): {
  categories: SetQuestionDistributionRow[]
  tags: SetQuestionDistributionRow[]
} {
  const categoryCounts = new Map<string, number>()
  const tagCounts = new Map<string, number>()

  for (const detail of details) {
    const categoryLabel = detail.categoryName?.trim() || 'Uncategorised'
    categoryCounts.set(categoryLabel, (categoryCounts.get(categoryLabel) ?? 0) + detail.questions.length)
    for (const question of detail.questions) {
      if (!question.tags || question.tags.length === 0) {
        tagCounts.set('Untagged', (tagCounts.get('Untagged') ?? 0) + 1)
        continue
      }
      for (const tag of question.tags) {
        const tagLabel = tag.name?.trim() || 'Unnamed tag'
        tagCounts.set(tagLabel, (tagCounts.get(tagLabel) ?? 0) + 1)
      }
    }
  }

  return {
    categories: sortDistribution(Array.from(categoryCounts, ([label, count]) => ({ label, count }))),
    tags: sortDistribution(Array.from(tagCounts, ([label, count]) => ({ label, count }))),
  }
}
