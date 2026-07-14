import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'

export type AutoSetMode = 'total' | 'category'
export type AutoStemVisibility = 'either' | 'public' | 'private'

export type AutoSetPreview = {
  selectedStems: UcatStemCatalogItem[]
  totalQuestions: number
  targetQuestions: number
  byCategory: Array<{
    categoryId: string
    categoryName: string
    targetQuestions: number
    actualQuestions: number
    stemCount: number
    eligibleStemCount: number
  }>
  warnings: string[]
}

export type AutoCategoryRow = {
  id?: string | null
  name?: string | null
  ucat_section_id?: string | null
}

export function positiveIntFromInput(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createSeededRandom(seed: string) {
  let state = hashString(seed) || 1
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state)
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state)
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const random = createSeededRandom(seed)
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = copy[index] as T
    copy[index] = copy[swapIndex] as T
    copy[swapIndex] = current
  }
  return copy
}

function chooseClosestWholeStemSet(stems: UcatStemCatalogItem[], targetQuestions: number): UcatStemCatalogItem[] {
  if (targetQuestions <= 0 || stems.length === 0) return []

  const choices = new Map<number, number[]>()
  choices.set(0, [])

  stems.forEach((stem, stemIndex) => {
    if (stem.questionsCount <= 0) return
    const existing = Array.from(choices.entries())
    for (const [total, indexes] of existing) {
      const nextTotal = total + stem.questionsCount
      if (!choices.has(nextTotal) || indexes.length + 1 < (choices.get(nextTotal)?.length ?? Number.MAX_SAFE_INTEGER)) {
        choices.set(nextTotal, [...indexes, stemIndex])
      }
    }
  })

  let bestTotal = 0
  let bestIndexes = choices.get(0) ?? []
  for (const [total, indexes] of choices.entries()) {
    const bestDiff = Math.abs(bestTotal - targetQuestions)
    const nextDiff = Math.abs(total - targetQuestions)
    const better =
      nextDiff < bestDiff ||
      (nextDiff === bestDiff && total < bestTotal) ||
      (nextDiff === bestDiff && total === bestTotal && indexes.length < bestIndexes.length)
    if (better) {
      bestTotal = total
      bestIndexes = indexes
    }
  }

  return bestIndexes.map((index) => stems[index]).filter((stem): stem is UcatStemCatalogItem => Boolean(stem))
}

export function buildAutoSetPreview({
  mode,
  targetTotal,
  categoryTargets,
  sectionId,
  stemVisibility,
  onlyNotInAnotherSet,
  categories,
  stems,
  seed,
}: {
  mode: AutoSetMode
  targetTotal: number
  categoryTargets: Record<string, string>
  sectionId: string | null
  stemVisibility: AutoStemVisibility
  onlyNotInAnotherSet: boolean
  categories: AutoCategoryRow[]
  stems: UcatStemCatalogItem[]
  seed: number
}): AutoSetPreview {
  if (!sectionId) {
    return { selectedStems: [], totalQuestions: 0, targetQuestions: 0, byCategory: [], warnings: [] }
  }

  const sectionCategories = categories
    .filter((category) => category.id && category.ucat_section_id === sectionId)
    .map((category) => ({ id: category.id as string, name: category.name ?? 'Untitled category' }))
  const categoryIds = new Set(sectionCategories.map((category) => category.id))
  const eligibleStems = stems.filter((stem) => {
    if (stem.sectionId !== sectionId) return false
    if (!stem.categoryId || !categoryIds.has(stem.categoryId)) return false
    if (stem.questionsCount <= 0) return false
    if (stemVisibility === 'public' && stem.accessScope === 'private') return false
    if (stemVisibility === 'private' && stem.accessScope !== 'private') return false
    if (onlyNotInAnotherSet && stem.setIds.length > 0) return false
    return true
  })

  const warnings: string[] = []

  if (mode === 'total') {
    const shuffled = shuffleWithSeed(
      eligibleStems,
      `total:${sectionId}:${targetTotal}:${stemVisibility}:${onlyNotInAnotherSet}:${seed}`,
    )
    const selectedStems = chooseClosestWholeStemSet(shuffled, targetTotal)
    const totalQuestions = selectedStems.reduce((sum, stem) => sum + stem.questionsCount, 0)
    if (targetTotal > 0 && selectedStems.length === 0) {
      warnings.push('No eligible stems match these criteria.')
    } else if (targetTotal > 0 && totalQuestions !== targetTotal) {
      warnings.push(`Whole stems make ${totalQuestions} questions, not exactly ${targetTotal}.`)
    }

    return {
      selectedStems: shuffleWithSeed(selectedStems, `order:${sectionId}:${targetTotal}:${seed}`),
      totalQuestions,
      targetQuestions: targetTotal,
      byCategory: [],
      warnings,
    }
  }

  const selectedByCategory: UcatStemCatalogItem[] = []
  const byCategory = sectionCategories
    .map((category) => {
      const targetQuestions = positiveIntFromInput(categoryTargets[category.id] ?? '')
      const categoryEligibleStems = eligibleStems.filter((stem) => stem.categoryId === category.id)
      if (targetQuestions <= 0) {
        return {
          categoryId: category.id,
          categoryName: category.name,
          targetQuestions,
          actualQuestions: 0,
          stemCount: 0,
          eligibleStemCount: categoryEligibleStems.length,
        }
      }

      const shuffled = shuffleWithSeed(
        categoryEligibleStems,
        `category:${category.id}:${targetQuestions}:${stemVisibility}:${onlyNotInAnotherSet}:${seed}`,
      )
      const selectedStems = chooseClosestWholeStemSet(shuffled, targetQuestions)
      selectedByCategory.push(...selectedStems)
      const actualQuestions = selectedStems.reduce((sum, stem) => sum + stem.questionsCount, 0)
      if (selectedStems.length === 0) {
        warnings.push(`${category.name}: no eligible stems match these criteria.`)
      } else if (actualQuestions !== targetQuestions) {
        warnings.push(`${category.name}: whole stems make ${actualQuestions} questions, not exactly ${targetQuestions}.`)
      }
      return {
        categoryId: category.id,
        categoryName: category.name,
        targetQuestions,
        actualQuestions,
        stemCount: selectedStems.length,
        eligibleStemCount: categoryEligibleStems.length,
      }
    })
    .filter((row) => row.targetQuestions > 0)

  const targetQuestions = byCategory.reduce((sum, row) => sum + row.targetQuestions, 0)
  const totalQuestions = selectedByCategory.reduce((sum, stem) => sum + stem.questionsCount, 0)
  const selectedStems = shuffleWithSeed(
    selectedByCategory,
    `category-order:${sectionId}:${JSON.stringify(categoryTargets)}:${seed}`,
  )

  if (targetQuestions > 0 && selectedStems.length === 0) {
    warnings.push('No eligible stems match these criteria.')
  }

  return {
    selectedStems,
    totalQuestions,
    targetQuestions,
    byCategory,
    warnings,
  }
}
