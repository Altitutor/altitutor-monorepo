import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  buildBlueprintSection,
  evaluateBlueprint,
  UCAT_ANZ_2026_V1,
  type BlueprintSectionCode,
  type BlueprintStem,
} from '@altitutor/ucat-blueprint'
import {
  blueprintSectionCode,
  catalogStemToBlueprintStem,
  evaluationToStoredCompliance,
  type StoredBlueprintCompliance,
} from '@/features/ucat/mocks/lib/blueprint-compliance'

export type AutoSetMode = 'total' | 'category' | 'blueprint'
export type AutoStemVisibility = 'either' | 'public' | 'private'

/** Default hard cap on stems passed into the exact blueprint DP (after shuffle). */
export const BLUEPRINT_CANDIDATE_STEM_CAP = 32
/** Soft budget: stop filling once candidate questions reach this multiple of the section total. */
export const BLUEPRINT_CANDIDATE_QUESTION_MULTIPLIER = 2
/** Keep the create-set UI responsive; Refresh retries another sample. */
export const BLUEPRINT_SEARCH_MAX_RUNTIME_MS = 400

function blueprintCandidateStemCap(section: BlueprintSectionCode, targetQuestions: number): number {
  switch (section) {
    case 'verbal_reasoning':
      return 22
    case 'decision_making':
      return Math.min(56, Math.max(BLUEPRINT_CANDIDATE_STEM_CAP, targetQuestions + 12))
    case 'quantitative_reasoning':
      return 40
    case 'situational_judgement':
      return 40
    default: {
      const _exhaustive: never = section
      return _exhaustive
    }
  }
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

function totalBlueprintQuestions(stems: BlueprintStem[]): number {
  return stems.reduce((sum, stem) => sum + stem.questions.length, 0)
}

function shortfallsFromAvailability(
  section: BlueprintSectionCode,
  candidates: BlueprintStem[],
  targetQuestions: number,
): Array<{ label: string; available: number; shortfall: number }> {
  const shortfalls: Array<{ label: string; available: number; shortfall: number }> = []
  const availableQuestions = totalBlueprintQuestions(candidates)
  if (availableQuestions < targetQuestions) {
    shortfalls.push({
      label: 'Candidate-visible question total',
      available: availableQuestions,
      shortfall: targetQuestions - availableQuestions,
    })
  }

  const policy = UCAT_ANZ_2026_V1.altitutorPolicy.sectionRules.find((rule) => rule.section === section)
  if (!policy) return shortfalls

  for (const rule of policy.categoryRules ?? []) {
    const label = rule.label ?? rule.category ?? 'Answer-scheme questions'
    const actual = rule.answerScheme === undefined
      ? rule.unit === 'stems'
        ? candidates.filter((stem) => stem.category === rule.category).length
        : totalBlueprintQuestions(candidates.filter((stem) => stem.category === rule.category))
      : candidates.reduce(
          (count, stem) =>
            count +
            (rule.unit === 'stems'
              ? Number(stem.questions.some((question) => question.answerScheme === rule.answerScheme))
              : stem.questions.filter((question) => question.answerScheme === rule.answerScheme).length),
          0,
        )
    if (actual < rule.min) {
      shortfalls.push({
        label,
        available: actual,
        shortfall: rule.min - actual,
      })
    }
  }

  for (const rule of policy.structureRules ?? []) {
    if (rule.kind !== 'stem_count') continue
    const actual = candidates.filter((stem) =>
      rule.questionCardinality === 'single' ? stem.questions.length === 1 : stem.questions.length > 1,
    ).length
    if (actual < rule.min) {
      shortfalls.push({
        label: rule.label,
        available: actual,
        shortfall: rule.min - actual,
      })
    }
  }

  return shortfalls
}

/**
 * Bounds the exact blueprint DP input: stratified round-robin by category for diversity,
 * then fill in shuffle order up to stem/question budgets.
 */
export function selectBlueprintCandidatePool(
  shuffled: UcatStemCatalogItem[],
  targetQuestions: number,
  options?: { stemCap?: number; questionMultiplier?: number },
): UcatStemCatalogItem[] {
  const stemCap = options?.stemCap ?? BLUEPRINT_CANDIDATE_STEM_CAP
  const questionBudget = targetQuestions * (options?.questionMultiplier ?? BLUEPRINT_CANDIDATE_QUESTION_MULTIPLIER)
  if (shuffled.length <= stemCap && totalQuestionsInCatalog(shuffled) <= questionBudget) {
    return shuffled
  }

  const byCategory = new Map<string, UcatStemCatalogItem[]>()
  for (const stem of shuffled) {
    const key = stem.categoryId ?? stem.categoryName ?? ''
    const list = byCategory.get(key) ?? []
    list.push(stem)
    byCategory.set(key, list)
  }

  const selected: UcatStemCatalogItem[] = []
  const selectedIds = new Set<string>()
  let questions = 0

  let progressed = true
  while (progressed && selected.length < stemCap && questions < questionBudget) {
    progressed = false
    for (const list of byCategory.values()) {
      if (selected.length >= stemCap || questions >= questionBudget) break
      const next = list.find((stem) => !selectedIds.has(stem.id))
      if (!next) continue
      selected.push(next)
      selectedIds.add(next.id)
      questions += next.questionsCount
      progressed = true
    }
  }

  for (const stem of shuffled) {
    if (selected.length >= stemCap) break
    if (questions >= questionBudget) break
    if (selectedIds.has(stem.id)) continue
    selected.push(stem)
    selectedIds.add(stem.id)
    questions += stem.questionsCount
  }

  return selected
}

function totalQuestionsInCatalog(stems: UcatStemCatalogItem[]): number {
  return stems.reduce((sum, stem) => sum + stem.questionsCount, 0)
}

function blueprintPreviewCompliance(
  section: BlueprintSectionCode,
  selectedStems: UcatStemCatalogItem[],
): StoredBlueprintCompliance {
  const official = UCAT_ANZ_2026_V1.official.sections.find((rule) => rule.section === section)
  const selectedEvaluation = evaluateBlueprint(UCAT_ANZ_2026_V1, {
    purpose: 'full_mock',
    sections: official ? [{
      section,
      answeringTimeSeconds: official.answeringTimeSeconds,
      instructionTimeSeconds: official.instructionTimeSeconds,
      stems: selectedStems.map(catalogStemToBlueprintStem),
    }] : [],
  })
  const blueprintCompliance = evaluationToStoredCompliance(selectedEvaluation)
  blueprintCompliance.sections = blueprintCompliance.sections
    .filter((result) => result.section === section)
    .map((result) => ({
      ...result,
      checks: result.checks.filter((check) => check.code !== 'SECTION_ORDER_INVALID'),
    }))
  blueprintCompliance.compliant = blueprintCompliance.sections.length === 1
    && blueprintCompliance.sections.every((result) => result.checks.every((check) => check.compliant))
  blueprintCompliance.reasons = []
  return blueprintCompliance
}

function formatShortfallWarnings(
  shortfalls: Array<{ label: string; available: number; shortfall: number }>,
): string[] {
  return shortfalls.map(
    (shortfall) => `${shortfall.label}: short by ${shortfall.shortfall} (${shortfall.available} available).`,
  )
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

  const warnings: string[] = []

  if (mode === 'blueprint') {
    const section = blueprintSectionCode(sectionNumber)
    if (!section) {
      return {
        selectedStems: [], totalQuestions: 0, targetQuestions: 0, byCategory: [],
        warnings: ['Select a recognised UCAT section for the 2026 blueprint.'],
      }
    }
    const official = UCAT_ANZ_2026_V1.official.sections.find((rule) => rule.section === section)
    const targetQuestions = official?.questionCount ?? 0
    const shuffled = shuffleWithSeed(eligibleStems, `blueprint:${section}:${seed}`)
    const fullBlueprintStems = shuffled.map(catalogStemToBlueprintStem)
    const catalogShortfalls = shortfallsFromAvailability(section, fullBlueprintStems, targetQuestions)
    if (catalogShortfalls.length > 0) {
      return {
        selectedStems: [],
        totalQuestions: 0,
        targetQuestions,
        byCategory: [],
        blueprintCompliance: blueprintPreviewCompliance(section, []),
        warnings: formatShortfallWarnings(catalogShortfalls),
      }
    }

    const candidatePool = selectBlueprintCandidatePool(shuffled, targetQuestions, {
      stemCap: blueprintCandidateStemCap(section, targetQuestions),
    })
    const build = buildBlueprintSection(
      UCAT_ANZ_2026_V1,
      section,
      candidatePool.map(catalogStemToBlueprintStem),
      { maxRuntimeMs: BLUEPRINT_SEARCH_MAX_RUNTIME_MS },
    )
    if (!build.compliant) {
      const timedOut = build.shortfalls.some((shortfall) => shortfall.label === 'Blueprint search time budget')
      return {
        selectedStems: [],
        totalQuestions: 0,
        targetQuestions,
        byCategory: [],
        blueprintCompliance: blueprintPreviewCompliance(section, []),
        warnings: [
          timedOut
            ? 'Blueprint search hit the time budget for this sample. Refresh to try another sample.'
            : 'This candidate sample could not form a compliant 2026 blueprint set. Refresh to try another sample.',
        ],
      }
    }

    const selectedIds = new Set(build.selectedStems.map((stem) => stem.id))
    const selectedStems = eligibleStems.filter((stem) => selectedIds.has(stem.id))
    return {
      selectedStems,
      totalQuestions: selectedStems.reduce((sum, stem) => sum + stem.questionsCount, 0),
      targetQuestions,
      byCategory: [],
      blueprintCompliance: blueprintPreviewCompliance(section, selectedStems),
      warnings: [],
    }
  }

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

/** Yields to the browser once, then builds — keeps create-set controls responsive. */
export async function buildAutoSetPreviewAsync(
  input: Parameters<typeof buildAutoSetPreview>[0],
): Promise<AutoSetPreview> {
  await yieldToMain()
  return buildAutoSetPreview(input)
}
