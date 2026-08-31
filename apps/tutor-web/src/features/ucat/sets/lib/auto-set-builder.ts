import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  evaluateBlueprint,
  type BlueprintSectionCode,
  type UcatBlueprint,
} from '@altitutor/ucat-blueprint'
import {
  blueprintSectionCode,
  catalogStemToBlueprintStem,
  evaluationToStoredCompliance,
  type StoredBlueprintCompliance,
} from '@/features/ucat/mocks/lib/blueprint-compliance'

export type AutoSetMode = 'total' | 'category' | 'range'
export type AutoStemVisibility = 'either' | 'public' | 'private'

export type AutoCategoryRangeInput = {
  min: string
  max: string
}

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
    minQuestions?: number
    maxQuestions?: number
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

export type AutoSetBuildInput = {
  mode: AutoSetMode
  blueprint?: UcatBlueprint | null
  targetTotal: number
  categoryTargets: Record<string, string>
  categoryRanges?: Record<string, AutoCategoryRangeInput>
  sectionId: string | null
  sectionNumber?: number | null
  stemVisibility: AutoStemVisibility
  onlyNotInAnotherSet: boolean
  categories: AutoCategoryRow[]
  stems: UcatStemCatalogItem[]
  existingStemIds?: string[]
  seed: number
}

export function positiveIntFromInput(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function nonNegativeIntFromInput(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function parseCategoryRange(input: AutoCategoryRangeInput | undefined): { min: number; max: number } | null {
  if (!input) return null
  const min = nonNegativeIntFromInput(input.min)
  const max = nonNegativeIntFromInput(input.max)
  if (min === null || max === null) return null
  return { min, max }
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

/** Achievable question totals → stem indexes (prefer fewer stems for the same total). */
function achievableQuestionTotals(stems: UcatStemCatalogItem[]): Map<number, number[]> {
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

  return choices
}

function chooseClosestWholeStemSet(stems: UcatStemCatalogItem[], targetQuestions: number): UcatStemCatalogItem[] {
  if (targetQuestions <= 0 || stems.length === 0) return []

  const choices = achievableQuestionTotals(stems)
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
  UcatBlueprint['altitutorPolicy']['sectionRules'][number]['categoryRules']
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

function toQuestionBounds(
  rule: CategoryPolicyRule,
  categoryStems: UcatStemCatalogItem[],
): { min: number; max: number; preferred: number } {
  const preferred = categoryRulePreferred(rule)
  if (rule.unit === 'stems') {
    const typical = typicalQuestionsPerStem(categoryStems)
    return {
      min: rule.min * typical,
      max: rule.max * typical,
      preferred: preferred * typical,
    }
  }
  return { min: rule.min, max: rule.max, preferred }
}

/** Map a selected full-mock blueprint into per-category question targets. */
export function blueprintPreferredCategoryTargets({
  blueprint,
  sectionNumber,
  categories,
  eligibleStems,
}: {
  blueprint: UcatBlueprint
  sectionNumber?: number | null
  categories: Array<{ id: string; name: string }>
  eligibleStems: UcatStemCatalogItem[]
}): Record<string, string> {
  const ranges = blueprintCategoryRanges({ blueprint, sectionNumber, categories, eligibleStems })
  const targets: Record<string, string> = {}
  for (const [categoryId, range] of Object.entries(ranges)) {
    const min = Number.parseInt(range.min, 10)
    const max = Number.parseInt(range.max, 10)
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue
    const preferred = range.preferred !== undefined
      ? Number.parseInt(range.preferred, 10)
      : Math.round((min + max) / 2)
    if (Number.isFinite(preferred) && preferred > 0) targets[categoryId] = String(preferred)
  }
  return targets
}

export type BlueprintCategoryRange = {
  min: string
  max: string
  preferred?: string
}

/** Map selected policy category rules into question min/max for range mode. */
export function blueprintCategoryRanges({
  blueprint,
  sectionNumber,
  categories,
  eligibleStems,
}: {
  blueprint: UcatBlueprint
  sectionNumber?: number | null
  categories: Array<{ id: string; name: string }>
  eligibleStems: UcatStemCatalogItem[]
}): Record<string, BlueprintCategoryRange> {
  const section = blueprintSectionCode(sectionNumber)
  if (!section) return {}

  const policy = blueprint.altitutorPolicy.sectionRules.find((rule) => rule.section === section)
  if (!policy?.categoryRules?.length) return {}

  const targets: Record<string, BlueprintCategoryRange> = {}
  const namedRules = policy.categoryRules.filter((rule) => Boolean(rule.category))
  const schemeOnlyRules = policy.categoryRules.filter((rule) => rule.answerScheme !== undefined && !rule.category)

  for (const rule of namedRules) {
    const categoryId = 'categoryId' in rule ? rule.categoryId : undefined
    const category = categories.find((row) => row.id === categoryId || (!categoryId && row.name === rule.category))
    if (!category) continue
    const categoryStems = eligibleStems.filter((stem) => stem.categoryId === category.id)
    const bounds = toQuestionBounds(rule, categoryStems)
    if (bounds.max > 0 || bounds.min > 0) {
      targets[category.id] = {
        min: String(bounds.min),
        max: String(bounds.max),
        preferred: String(bounds.preferred),
      }
    }
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

    const allocateAcross = (amount: number): Record<string, number> => {
      const shares: Record<string, number> = {}
      if (totalCapacity <= 0) {
        const even = Math.floor(amount / remaining.length)
        let leftover = amount - even * remaining.length
        for (const category of remaining) {
          const share = even + (leftover > 0 ? 1 : 0)
          if (leftover > 0) leftover -= 1
          shares[category.id] = Math.max(0, share)
        }
        return shares
      }
      let allocated = 0
      capacities.forEach((row, index) => {
        if (index === capacities.length - 1) {
          shares[row.id] = Math.max(0, amount - allocated)
          return
        }
        const share = Math.round((amount * row.capacity) / totalCapacity)
        allocated += share
        shares[row.id] = Math.max(0, share)
      })
      return shares
    }

    const minShares = allocateAcross(rule.min)
    const maxShares = allocateAcross(rule.max)
    const preferredShares = allocateAcross(preferred)
    for (const category of remaining) {
      const min = minShares[category.id] ?? 0
      const max = Math.max(min, maxShares[category.id] ?? 0)
      if (max <= 0 && min <= 0) continue
      targets[category.id] = {
        min: String(min),
        max: String(max),
        preferred: String(preferredShares[category.id] ?? Math.round((min + max) / 2)),
      }
    }
  }

  return targets
}

function blueprintPreviewCompliance(
  blueprint: UcatBlueprint,
  section: BlueprintSectionCode,
  selectedStems: UcatStemCatalogItem[],
): StoredBlueprintCompliance {
  const official = blueprint.official.sections.find((rule) => rule.section === section)
  const selectedEvaluation = evaluateBlueprint(blueprint, {
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

type RangeCategoryPlan = {
  categoryId: string
  categoryName: string
  min: number
  max: number
  preferred: number
  eligibleStemCount: number
  shuffled: UcatStemCatalogItem[]
  inRangeTotals: Map<number, number[]>
}

function buildRangePreview({
  sectionId,
  sectionCategories,
  eligibleStems,
  categoryRanges,
  targetTotal,
  preferredByCategory,
  stemVisibility,
  onlyNotInAnotherSet,
  seed,
}: {
  sectionId: string
  sectionCategories: Array<{ id: string; name: string }>
  eligibleStems: UcatStemCatalogItem[]
  categoryRanges: Record<string, AutoCategoryRangeInput>
  targetTotal: number
  preferredByCategory?: Record<string, number>
  stemVisibility: AutoStemVisibility
  onlyNotInAnotherSet: boolean
  seed: number
}): Omit<AutoSetPreview, 'blueprintCompliance'> {
  const warnings: string[] = []
  const plans: RangeCategoryPlan[] = []

  for (const category of sectionCategories) {
    const parsed = parseCategoryRange(categoryRanges[category.id])
    if (!parsed) continue
    if (parsed.max < parsed.min) {
      warnings.push(
        `${category.name}: max (${parsed.max}) is less than min (${parsed.min}).`,
      )
      return {
        selectedStems: [],
        totalQuestions: 0,
        targetQuestions: targetTotal,
        byCategory: [],
        warnings,
      }
    }

    const categoryEligibleStems = eligibleStems.filter((stem) => stem.categoryId === category.id)
    const preferred =
      preferredByCategory?.[category.id]
      ?? Math.round((parsed.min + parsed.max) / 2)
    const shuffled = shuffleWithSeed(
      categoryEligibleStems,
      `range:${category.id}:${parsed.min}:${parsed.max}:${stemVisibility}:${onlyNotInAnotherSet}:${seed}`,
    )
    const achievable = achievableQuestionTotals(shuffled)
    const inRangeTotals = new Map<number, number[]>()
    for (const [total, indexes] of achievable.entries()) {
      if (total >= parsed.min && total <= parsed.max) {
        inRangeTotals.set(total, indexes)
      }
    }

    plans.push({
      categoryId: category.id,
      categoryName: category.name,
      min: parsed.min,
      max: parsed.max,
      preferred,
      eligibleStemCount: categoryEligibleStems.length,
      shuffled,
      inRangeTotals,
    })
  }

  if (plans.length === 0 || targetTotal <= 0) {
    return {
      selectedStems: [],
      totalQuestions: 0,
      targetQuestions: targetTotal,
      byCategory: [],
      warnings: targetTotal <= 0 ? warnings : [...warnings, 'Enter a positive question total and at least one category range.'],
    }
  }

  const sumMin = plans.reduce((sum, plan) => sum + plan.min, 0)
  const sumMax = plans.reduce((sum, plan) => sum + plan.max, 0)
  if (sumMin > targetTotal) {
    return {
      selectedStems: [],
      totalQuestions: 0,
      targetQuestions: targetTotal,
      byCategory: plans.map((plan) => ({
        categoryId: plan.categoryId,
        categoryName: plan.categoryName,
        targetQuestions: plan.preferred,
        minQuestions: plan.min,
        maxQuestions: plan.max,
        actualQuestions: 0,
        stemCount: 0,
        eligibleStemCount: plan.eligibleStemCount,
      })),
      warnings: [
        ...warnings,
        `Sum of minimums (${sumMin}) exceeds the global total (${targetTotal}).`,
      ],
    }
  }
  if (sumMax < targetTotal) {
    return {
      selectedStems: [],
      totalQuestions: 0,
      targetQuestions: targetTotal,
      byCategory: plans.map((plan) => ({
        categoryId: plan.categoryId,
        categoryName: plan.categoryName,
        targetQuestions: plan.preferred,
        minQuestions: plan.min,
        maxQuestions: plan.max,
        actualQuestions: 0,
        stemCount: 0,
        eligibleStemCount: plan.eligibleStemCount,
      })),
      warnings: [
        ...warnings,
        `Sum of maximums (${sumMax}) is below the global total (${targetTotal}).`,
      ],
    }
  }

  for (const plan of plans) {
    if (plan.inRangeTotals.size === 0) {
      warnings.push(
        `${plan.categoryName}: no whole-stem combination falls in ${plan.min}–${plan.max} questions.`,
      )
    }
  }
  if (plans.some((plan) => plan.inRangeTotals.size === 0)) {
    return {
      selectedStems: [],
      totalQuestions: 0,
      targetQuestions: targetTotal,
      byCategory: plans.map((plan) => ({
        categoryId: plan.categoryId,
        categoryName: plan.categoryName,
        targetQuestions: plan.preferred,
        minQuestions: plan.min,
        maxQuestions: plan.max,
        actualQuestions: 0,
        stemCount: 0,
        eligibleStemCount: plan.eligibleStemCount,
      })),
      warnings,
    }
  }

  type CombineState = {
    assignments: number[]
    preferredDistance: number
    stemCount: number
  }

  let states = new Map<number, CombineState>()
  states.set(0, { assignments: [], preferredDistance: 0, stemCount: 0 })

  for (const plan of plans) {
    const nextStates = new Map<number, CombineState>()
    for (const [sum, state] of states.entries()) {
      for (const [total, indexes] of plan.inRangeTotals.entries()) {
        const nextSum = sum + total
        const next: CombineState = {
          assignments: [...state.assignments, total],
          preferredDistance: state.preferredDistance + Math.abs(total - plan.preferred),
          stemCount: state.stemCount + indexes.length,
        }
        const existing = nextStates.get(nextSum)
        const better =
          !existing ||
          next.preferredDistance < existing.preferredDistance ||
          (next.preferredDistance === existing.preferredDistance && next.stemCount < existing.stemCount)
        if (better) nextStates.set(nextSum, next)
      }
    }
    states = nextStates
  }

  if (states.size === 0) {
    return {
      selectedStems: [],
      totalQuestions: 0,
      targetQuestions: targetTotal,
      byCategory: plans.map((plan) => ({
        categoryId: plan.categoryId,
        categoryName: plan.categoryName,
        targetQuestions: plan.preferred,
        minQuestions: plan.min,
        maxQuestions: plan.max,
        actualQuestions: 0,
        stemCount: 0,
        eligibleStemCount: plan.eligibleStemCount,
      })),
      warnings: [...warnings, 'No eligible stems match these criteria.'],
    }
  }

  let bestSum = -1
  let bestState: CombineState | null = null
  for (const [sum, state] of states.entries()) {
    if (!bestState) {
      bestSum = sum
      bestState = state
      continue
    }
    const bestDiff = Math.abs(bestSum - targetTotal)
    const nextDiff = Math.abs(sum - targetTotal)
    const better =
      nextDiff < bestDiff ||
      (nextDiff === bestDiff && state.preferredDistance < bestState.preferredDistance) ||
      (nextDiff === bestDiff
        && state.preferredDistance === bestState.preferredDistance
        && sum < bestSum) ||
      (nextDiff === bestDiff
        && state.preferredDistance === bestState.preferredDistance
        && sum === bestSum
        && state.stemCount < bestState.stemCount)
    if (better) {
      bestSum = sum
      bestState = state
    }
  }

  if (!bestState) {
    return {
      selectedStems: [],
      totalQuestions: 0,
      targetQuestions: targetTotal,
      byCategory: [],
      warnings: [...warnings, 'No eligible stems match these criteria.'],
    }
  }

  const selectedByCategory: UcatStemCatalogItem[] = []
  const byCategory = plans.map((plan, index) => {
    const chosenTotal = bestState.assignments[index] ?? 0
    const indexes = plan.inRangeTotals.get(chosenTotal) ?? []
    const selectedStems = indexes
      .map((stemIndex) => plan.shuffled[stemIndex])
      .filter((stem): stem is UcatStemCatalogItem => Boolean(stem))
    selectedByCategory.push(...selectedStems)
    return {
      categoryId: plan.categoryId,
      categoryName: plan.categoryName,
      targetQuestions: plan.preferred,
      minQuestions: plan.min,
      maxQuestions: plan.max,
      actualQuestions: chosenTotal,
      stemCount: selectedStems.length,
      eligibleStemCount: plan.eligibleStemCount,
    }
  })

  const selectedStems = shuffleWithSeed(
    selectedByCategory,
    `range-order:${sectionId}:${targetTotal}:${JSON.stringify(categoryRanges)}:${seed}`,
  )
  const totalQuestions = selectedStems.reduce((sum, stem) => sum + stem.questionsCount, 0)

  if (totalQuestions !== targetTotal) {
    warnings.push(
      `Whole stems make ${totalQuestions} questions, not exactly ${targetTotal}.`,
    )
  }

  return {
    selectedStems,
    totalQuestions,
    targetQuestions: targetTotal,
    byCategory,
    warnings,
  }
}

function officialQuestionCount(blueprint: UcatBlueprint, sectionNumber?: number | null): number {
  const section = blueprintSectionCode(sectionNumber)
  if (!section) return 0
  return blueprint.official.sections.find((rule) => rule.section === section)?.questionCount ?? 0
}

function buildAutoSetPreviewCore({
  mode,
  blueprint = null,
  targetTotal,
  categoryTargets,
  categoryRanges = {},
  sectionId,
  sectionNumber,
  stemVisibility,
  onlyNotInAnotherSet,
  categories,
  stems,
  seed,
}: Omit<AutoSetBuildInput, 'existingStemIds'>): AutoSetPreview {
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

  const useBlueprint = blueprint != null
  const section = blueprintSectionCode(sectionNumber)

  if (mode === 'range') {
    const preferredFromBlueprint = useBlueprint
      ? blueprintCategoryRanges({
          blueprint,
          sectionNumber,
          categories: sectionCategories,
          eligibleStems,
        })
      : {}
    const preferredByCategory: Record<string, number> = {}
    for (const [categoryId, range] of Object.entries(preferredFromBlueprint)) {
      if (range.preferred) {
        const preferred = Number.parseInt(range.preferred, 10)
        if (Number.isFinite(preferred)) preferredByCategory[categoryId] = preferred
      }
    }

    const effectiveTotal = targetTotal > 0
      ? targetTotal
      : useBlueprint && Object.keys(categoryRanges).length === 0
        ? officialQuestionCount(blueprint, sectionNumber)
        : 0
    const effectiveRanges = Object.keys(categoryRanges).length > 0
      ? categoryRanges
      : useBlueprint
        ? Object.fromEntries(
            Object.entries(preferredFromBlueprint).map(([id, range]) => [id, { min: range.min, max: range.max }]),
          )
        : categoryRanges

    const hasOptedInRange = Object.values(effectiveRanges).some((range) => parseCategoryRange(range))
    if (!hasOptedInRange && useBlueprint) {
      const shuffled = shuffleWithSeed(
        eligibleStems,
        `blueprint-total:${sectionId}:${effectiveTotal}:${stemVisibility}:${onlyNotInAnotherSet}:${seed}`,
      )
      const selectedStems = chooseClosestWholeStemSet(shuffled, effectiveTotal)
      const totalQuestions = selectedStems.reduce((sum, stem) => sum + stem.questionsCount, 0)
      const warnings: string[] = []
      if (effectiveTotal > 0 && selectedStems.length === 0) {
        warnings.push('No eligible stems match these criteria.')
      } else if (effectiveTotal > 0 && totalQuestions !== effectiveTotal) {
        warnings.push(`Whole stems make ${totalQuestions} questions, not exactly ${effectiveTotal}.`)
      }
      return {
        selectedStems: shuffleWithSeed(selectedStems, `order:${sectionId}:${effectiveTotal}:${seed}`),
        totalQuestions,
        targetQuestions: effectiveTotal,
        byCategory: [],
        warnings,
        blueprintCompliance: section ? blueprintPreviewCompliance(blueprint, section, selectedStems) : undefined,
      }
    }

    const preview = buildRangePreview({
      sectionId,
      sectionCategories,
      eligibleStems,
      categoryRanges: effectiveRanges,
      targetTotal: effectiveTotal,
      preferredByCategory: Object.keys(preferredByCategory).length > 0 ? preferredByCategory : undefined,
      stemVisibility,
      onlyNotInAnotherSet,
      seed,
    })

    return {
      ...preview,
      blueprintCompliance: useBlueprint && section
        ? blueprintPreviewCompliance(blueprint, section, preview.selectedStems)
        : undefined,
    }
  }

  if (mode === 'category') {
    const hasManualTargets = Object.values(categoryTargets).some((value) => positiveIntFromInput(value) > 0)
    const resolvedTargets =
      hasManualTargets
        ? categoryTargets
        : useBlueprint && Object.keys(categoryTargets).length === 0
          ? blueprintPreferredCategoryTargets({
              blueprint,
              sectionNumber,
              categories: sectionCategories,
              eligibleStems,
            })
          : categoryTargets

    const hasCategoryPreset = Object.values(resolvedTargets).some((value) => positiveIntFromInput(value) > 0)

    if (useBlueprint && !hasCategoryPreset) {
      // QR-style: structure-only — fall back to official total path.
      const officialTotal = officialQuestionCount(blueprint, sectionNumber)
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
        byCategory: [],
        warnings,
        blueprintCompliance: section ? blueprintPreviewCompliance(blueprint, section, selectedStems) : undefined,
      }
    }

    const preview = buildCategoryPreview({
      sectionId,
      sectionCategories,
      eligibleStems,
      categoryTargets: resolvedTargets,
      stemVisibility,
      onlyNotInAnotherSet,
      seed,
    })

    return {
      ...preview,
      blueprintCompliance: useBlueprint && section
        ? blueprintPreviewCompliance(blueprint, section, preview.selectedStems)
        : undefined,
    }
  }

  // total
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

function eligibleFillStem(
  stem: UcatStemCatalogItem,
  input: AutoSetBuildInput,
  categoryIds: Set<string>,
  existingIds: Set<string>,
): boolean {
  if (stem.sectionId !== input.sectionId) return false
  if (!stem.categoryId || !categoryIds.has(stem.categoryId)) return false
  if (stem.questionsCount <= 0) return false
  if (input.stemVisibility === 'public' && stem.accessScope === 'private') return false
  if (input.stemVisibility === 'private' && stem.accessScope !== 'private') return false
  if (input.onlyNotInAnotherSet && stem.setIds.length > 0 && !existingIds.has(stem.id)) return false
  return true
}

function questionCountsByCategory(stems: UcatStemCatalogItem[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const stem of stems) {
    if (!stem.categoryId) continue
    counts.set(stem.categoryId, (counts.get(stem.categoryId) ?? 0) + stem.questionsCount)
  }
  return counts
}

function mergeFillPreview({
  input,
  existingStems,
  additions,
  targetQuestions,
  byCategory,
  warnings = additions.warnings,
}: {
  input: AutoSetBuildInput
  existingStems: UcatStemCatalogItem[]
  additions: AutoSetPreview
  targetQuestions: number
  byCategory: AutoSetPreview['byCategory']
  warnings?: string[]
}): AutoSetPreview {
  const existingIds = new Set(existingStems.map((stem) => stem.id))
  const selectedStems = [
    ...existingStems,
    ...additions.selectedStems.filter((stem) => !existingIds.has(stem.id)),
  ]
  const totalQuestions = selectedStems.reduce((sum, stem) => sum + stem.questionsCount, 0)
  const section = blueprintSectionCode(input.sectionNumber)
  return {
    selectedStems,
    totalQuestions,
    targetQuestions,
    byCategory,
    warnings,
    blueprintCompliance: input.blueprint && section
      ? blueprintPreviewCompliance(input.blueprint, section, selectedStems)
      : undefined,
  }
}

/**
 * Builds a new set or additively fills an existing set. Existing stems remain in
 * their authored order and count toward total/category targets; only the
 * remaining capacity is selected from eligible candidates.
 */
export function buildAutoSetPreview(input: AutoSetBuildInput): AutoSetPreview {
  const existingIds = new Set(input.existingStemIds ?? [])
  if (existingIds.size === 0) return buildAutoSetPreviewCore(input)

  const stemById = new Map(input.stems.map((stem) => [stem.id, stem]))
  const existingStems = (input.existingStemIds ?? []).flatMap((id) => {
    const stem = stemById.get(id)
    return stem ? [stem] : []
  })
  const sectionCategories = input.categories
    .filter((category) => category.id && category.ucat_section_id === input.sectionId)
    .map((category) => ({ id: category.id as string, name: category.name ?? 'Untitled category' }))
  const categoryIds = new Set(sectionCategories.map((category) => category.id))
  const eligibleStems = input.stems.filter((stem) =>
    eligibleFillStem(stem, input, categoryIds, existingIds),
  )
  const candidateStems = eligibleStems.filter((stem) => !existingIds.has(stem.id))
  const existingQuestions = existingStems.reduce((sum, stem) => sum + stem.questionsCount, 0)
  const existingByCategory = questionCountsByCategory(existingStems)
  const blueprint = input.blueprint ?? null

  if (input.mode === 'total') {
    const additions = buildAutoSetPreviewCore({
      ...input,
      blueprint: null,
      stems: candidateStems,
      targetTotal: Math.max(0, input.targetTotal - existingQuestions),
    })
    return mergeFillPreview({
      input,
      existingStems,
      additions,
      targetQuestions: input.targetTotal,
      byCategory: [],
    })
  }

  if (input.mode === 'category') {
    const hasManualTargets = Object.values(input.categoryTargets)
      .some((value) => positiveIntFromInput(value) > 0)
    const targets = hasManualTargets
      ? input.categoryTargets
      : blueprint
        ? blueprintPreferredCategoryTargets({
            blueprint,
            sectionNumber: input.sectionNumber,
            categories: sectionCategories,
            eligibleStems,
          })
        : input.categoryTargets
    const remainingTargets = Object.fromEntries(
      Object.entries(targets).map(([categoryId, value]) => [
        categoryId,
        String(Math.max(0, positiveIntFromInput(value) - (existingByCategory.get(categoryId) ?? 0))),
      ]),
    )
    const hasRemaining = Object.values(remainingTargets)
      .some((value) => positiveIntFromInput(value) > 0)
    const additions = hasRemaining
      ? buildAutoSetPreviewCore({
          ...input,
          blueprint: null,
          stems: candidateStems,
          categoryTargets: remainingTargets,
        })
      : { selectedStems: [], totalQuestions: 0, targetQuestions: 0, byCategory: [], warnings: [] }
    const additionsByCategory = questionCountsByCategory(additions.selectedStems)
    const byCategory = sectionCategories.flatMap((category) => {
      const target = positiveIntFromInput(targets[category.id] ?? '')
      if (target <= 0) return []
      const categoryCandidates = eligibleStems.filter((stem) => stem.categoryId === category.id)
      return [{
        categoryId: category.id,
        categoryName: category.name,
        targetQuestions: target,
        actualQuestions:
          (existingByCategory.get(category.id) ?? 0) +
          (additionsByCategory.get(category.id) ?? 0),
        stemCount:
          existingStems.filter((stem) => stem.categoryId === category.id).length +
          additions.selectedStems.filter((stem) => stem.categoryId === category.id).length,
        eligibleStemCount: categoryCandidates.length,
      }]
    })
    return mergeFillPreview({
      input,
      existingStems,
      additions,
      targetQuestions: Object.values(targets)
        .reduce((sum, value) => sum + positiveIntFromInput(value), 0),
      byCategory,
    })
  }

  const blueprintRanges = blueprint
    ? blueprintCategoryRanges({
        blueprint,
        sectionNumber: input.sectionNumber,
        categories: sectionCategories,
        eligibleStems,
      })
    : {}
  const ranges = Object.keys(input.categoryRanges ?? {}).length > 0
    ? (input.categoryRanges ?? {})
    : Object.fromEntries(
        Object.entries(blueprintRanges).map(([id, range]) => [id, { min: range.min, max: range.max }]),
      )
  const sectionCode = blueprintSectionCode(input.sectionNumber)
  const targetTotal = input.targetTotal > 0
    ? input.targetTotal
    : blueprint && sectionCode
      ? (blueprint.official.sections.find((section) => section.section === sectionCode)?.questionCount ?? 0)
      : 0
  const remainingTotal = Math.max(0, targetTotal - existingQuestions)
  const remainingRanges = Object.fromEntries(
    Object.entries(ranges).map(([categoryId, range]) => {
      const parsed = parseCategoryRange(range)
      const existing = existingByCategory.get(categoryId) ?? 0
      return [categoryId, parsed
        ? { min: String(Math.max(0, parsed.min - existing)), max: String(Math.max(0, parsed.max - existing)) }
        : range]
    }),
  )
  const hasRanges = Object.values(remainingRanges).some((range) => parseCategoryRange(range))
  const additions = remainingTotal > 0
    ? buildAutoSetPreviewCore({
        ...input,
        mode: hasRanges ? 'range' : 'total',
        blueprint: null,
        stems: candidateStems,
        targetTotal: remainingTotal,
        categoryRanges: remainingRanges,
      })
    : { selectedStems: [], totalQuestions: 0, targetQuestions: 0, byCategory: [], warnings: [] }
  const additionsByCategory = questionCountsByCategory(additions.selectedStems)
  const warnings = [...additions.warnings]
  const byCategory = sectionCategories.flatMap((category) => {
    const parsed = parseCategoryRange(ranges[category.id])
    if (!parsed) return []
    const existing = existingByCategory.get(category.id) ?? 0
    if (existing > parsed.max) {
      warnings.push(`${category.name} already has ${existing} questions, above the requested maximum of ${parsed.max}.`)
    }
    const preferred = blueprintRanges[category.id]?.preferred
      ? Number.parseInt(blueprintRanges[category.id]?.preferred ?? '', 10)
      : Math.round((parsed.min + parsed.max) / 2)
    return [{
      categoryId: category.id,
      categoryName: category.name,
      targetQuestions: Number.isFinite(preferred) ? preferred : parsed.max,
      minQuestions: parsed.min,
      maxQuestions: parsed.max,
      actualQuestions: existing + (additionsByCategory.get(category.id) ?? 0),
      stemCount:
        existingStems.filter((stem) => stem.categoryId === category.id).length +
        additions.selectedStems.filter((stem) => stem.categoryId === category.id).length,
      eligibleStemCount: eligibleStems.filter((stem) => stem.categoryId === category.id).length,
    }]
  })
  return mergeFillPreview({
    input,
    existingStems,
    additions,
    targetQuestions: targetTotal,
    byCategory,
    warnings,
  })
}

/** Yields to the browser once, then builds — keeps create-set controls responsive. */
export async function buildAutoSetPreviewAsync(
  input: Parameters<typeof buildAutoSetPreview>[0],
): Promise<AutoSetPreview> {
  await yieldToMain()
  return buildAutoSetPreview(input)
}
