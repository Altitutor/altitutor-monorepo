import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  evaluateBlueprint,
  UCAT_ANZ_2026_V1,
  type BlueprintSectionCode,
} from '@altitutor/ucat-blueprint'
import {
  blueprintSectionCode,
  catalogStemToBlueprintStem,
  evaluationToStoredCompliance,
  type StoredBlueprintCompliance,
} from '@/features/ucat/mocks/lib/blueprint-compliance'

export type AutoSetMode = 'total' | 'category' | 'blueprint'
export type AutoStemVisibility = 'either' | 'public' | 'private'

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve()
      return
    }
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 0)
    })
  })
}

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
  blueprintCompliance?: StoredBlueprintCompliance
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

type CategoryPolicyRule = NonNullable<
  (typeof UCAT_ANZ_2026_V1.altitutorPolicy.sectionRules)[number]['categoryRules']
>[number]

function categoryRulePreferred(rule: CategoryPolicyRule): number {
  if (rule.preferred !== undefined) return rule.preferred
  return Math.round((rule.min + rule.max) / 2)
}

function typicalQuestionsPerStem(stems: UcatStemCatalogItem[]): number {
  if (stems.length === 0) return 1
  const counts = [...stems.map((stem) => stem.questionsCount)].sort((a, b) => a - b)
  return counts[Math.floor(counts.length / 2)] ?? 1
}

/**
 * Map the 2026 full-mock blueprint into the same per-category question targets
 * used by "By category" mode (stem-unit rules convert via typical questions/stem).
 */
export function blueprintPreferredCategoryTargets({
  sectionNumber,
  categories,
  eligibleStems,
}: {
  sectionNumber?: number | null
  categories: Array<{ id: string; name: string }>
  eligibleStems: UcatStemCatalogItem[]
}): Record<string, string> {
  const section = blueprintSectionCode(sectionNumber)
  if (!section) return {}

  const policy = UCAT_ANZ_2026_V1.altitutorPolicy.sectionRules.find((rule) => rule.section === section)
  if (!policy?.categoryRules?.length) return {}

  const targets: Record<string, string> = {}
  const namedRules = policy.categoryRules.filter((rule) => Boolean(rule.category))
  const schemeOnlyRules = policy.categoryRules.filter((rule) => rule.answerScheme !== undefined && !rule.category)

  for (const rule of namedRules) {
    const category = categories.find((row) => row.name === rule.category)
    if (!category) continue
    const categoryStems = eligibleStems.filter((stem) => stem.categoryId === category.id)
    const preferred = categoryRulePreferred(rule)
    const questionTarget =
      rule.unit === 'stems' ? preferred * typicalQuestionsPerStem(categoryStems) : preferred
    if (questionTarget > 0) targets[category.id] = String(questionTarget)
  }

  for (const rule of schemeOnlyRules) {
    const remaining = categories.filter((category) => !(category.id in targets))
    if (remaining.length === 0) continue
    const preferred = categoryRulePreferred(rule)
    const capacities = remaining.map((category) => ({
      id: category.id,
      capacity: eligibleStems
        .filter((stem) => stem.categoryId === category.id)
        .reduce((sum, stem) => sum + stem.questionsCount, 0),
    }))
    const totalCapacity = capacities.reduce((sum, row) => sum + row.capacity, 0)
    if (totalCapacity <= 0) {
      const even = Math.floor(preferred / remaining.length)
      let leftover = preferred - even * remaining.length
      for (const category of remaining) {
        const share = even + (leftover > 0 ? 1 : 0)
        if (leftover > 0) leftover -= 1
        if (share > 0) targets[category.id] = String(share)
      }
      continue
    }

    let allocated = 0
    capacities.forEach((row, index) => {
      if (index === capacities.length - 1) {
        const share = Math.max(0, preferred - allocated)
        if (share > 0) targets[row.id] = String(share)
        return
      }
      const share = Math.round((preferred * row.capacity) / totalCapacity)
      allocated += share
      if (share > 0) targets[row.id] = String(share)
    })
  }

  return targets
}

function blueprintPreviewCompliance(
  section: BlueprintSectionCode,
  selectedStems: UcatStemCatalogItem[],
): StoredBlueprintCompliance {
  const official = UCAT_ANZ_2026_V1.official.sections.find((rule) => rule.section === section)
  const selectedEvaluation = evaluateBlueprint(UCAT_ANZ_2026_V1, {
    purpose: 'full_mock',
    sections: official
      ? [{
          section,
          answeringTimeSeconds: official.answeringTimeSeconds,
          instructionTimeSeconds: official.instructionTimeSeconds,
          stems: selectedStems.map(catalogStemToBlueprintStem),
        }]
      : [],
  })
  const blueprintCompliance = evaluationToStoredCompliance(selectedEvaluation)
  blueprintCompliance.sections = blueprintCompliance.sections
    .filter((result) => result.section === section)
    .map((result) => ({
      ...result,
      checks: result.checks.filter((check) => check.code !== 'SECTION_ORDER_INVALID'),
    }))
  blueprintCompliance.compliant =
    blueprintCompliance.sections.length === 1
    && blueprintCompliance.sections.every((result) => result.checks.every((check) => check.compliant))
  blueprintCompliance.reasons = []
  return blueprintCompliance
}

function buildCategoryPreview({
  sectionId,
  sectionCategories,
  eligibleStems,
  categoryTargets,
  stemVisibility,
  onlyNotInAnotherSet,
  seed,
}: {
  sectionId: string
  sectionCategories: Array<{ id: string; name: string }>
  eligibleStems: UcatStemCatalogItem[]
  categoryTargets: Record<string, string>
  stemVisibility: AutoStemVisibility
  onlyNotInAnotherSet: boolean
  seed: number
}): Omit<AutoSetPreview, 'blueprintCompliance'> {
  const warnings: string[] = []
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
        warnings.push(
          `${category.name}: whole stems make ${actualQuestions} questions, not exactly ${targetQuestions}.`,
        )
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

export function buildAutoSetPreview({
  mode,
  targetTotal,
  categoryTargets,
  sectionId,
  sectionNumber,
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
  sectionNumber?: number | null
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

  if (mode === 'blueprint') {
    const section = blueprintSectionCode(sectionNumber)
    if (!section) {
      return {
        selectedStems: [],
        totalQuestions: 0,
        targetQuestions: 0,
        byCategory: [],
        warnings: ['Select a recognised UCAT section for the 2026 blueprint.'],
      }
    }

    const official = UCAT_ANZ_2026_V1.official.sections.find((rule) => rule.section === section)
    const officialTotal = official?.questionCount ?? 0
    const presetTargets = blueprintPreferredCategoryTargets({
      sectionNumber,
      categories: sectionCategories,
      eligibleStems,
    })
    const hasCategoryPreset = Object.values(presetTargets).some((value) => positiveIntFromInput(value) > 0)

    // Sections with named category composition (VR/DM/SJ): same path as "By category".
    // QR (structure-only): same path as "Total only" at the official question count.
    const preview = hasCategoryPreset
      ? buildCategoryPreview({
          sectionId,
          sectionCategories,
          eligibleStems,
          categoryTargets: presetTargets,
          stemVisibility,
          onlyNotInAnotherSet,
          seed,
        })
      : (() => {
          const shuffled = shuffleWithSeed(
            eligibleStems,
            `blueprint-total:${sectionId}:${officialTotal}:${stemVisibility}:${onlyNotInAnotherSet}:${seed}`,
          )
          const selectedStems = chooseClosestWholeStemSet(shuffled, officialTotal)
          const totalQuestions = selectedStems.reduce((sum, stem) => sum + stem.questionsCount, 0)
          const warnings: string[] = []
          if (officialTotal > 0 && selectedStems.length === 0) {
            warnings.push('No eligible stems match these criteria.')
          } else if (officialTotal > 0 && totalQuestions !== officialTotal) {
            warnings.push(`Whole stems make ${totalQuestions} questions, not exactly ${officialTotal}.`)
          }
          return {
            selectedStems: shuffleWithSeed(selectedStems, `order:${sectionId}:${officialTotal}:${seed}`),
            totalQuestions,
            targetQuestions: officialTotal,
            byCategory: [] as AutoSetPreview['byCategory'],
            warnings,
          }
        })()

    return {
      ...preview,
      targetQuestions: hasCategoryPreset ? preview.targetQuestions : officialTotal,
      blueprintCompliance: blueprintPreviewCompliance(section, preview.selectedStems),
    }
  }

  if (mode === 'total') {
    const warnings: string[] = []
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

  return buildCategoryPreview({
    sectionId,
    sectionCategories,
    eligibleStems,
    categoryTargets,
    stemVisibility,
    onlyNotInAnotherSet,
    seed,
  })
}

/** Yields to the browser once, then builds — keeps create-set controls responsive. */
export async function buildAutoSetPreviewAsync(
  input: Parameters<typeof buildAutoSetPreview>[0],
): Promise<AutoSetPreview> {
  await yieldToMain()
  return buildAutoSetPreview(input)
}
