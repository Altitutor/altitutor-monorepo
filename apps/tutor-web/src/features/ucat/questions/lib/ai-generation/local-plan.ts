import type { AiGenerationBrief } from './prompts'

type DifficultyTarget = AiGenerationBrief['difficultyTarget']
type TimeBurdenTarget = AiGenerationBrief['timeBurdenTarget']

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/gu, ' ')
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pick<T>(items: T[], seed: string): T | null {
  if (items.length === 0) return null
  return items[stableHash(seed) % items.length] ?? items[0] ?? null
}

function exactAvailableCategory(brief: AiGenerationBrief, desiredName: string | null | undefined): string | null {
  if (!desiredName) return null
  const desired = normalizeLabel(desiredName)
  return brief.availableCategories?.find((category) => normalizeLabel(category.name) === desired)?.name ?? null
}

function availableCategoryNames(brief: AiGenerationBrief): string[] {
  return (brief.availableCategories ?? []).map((category) => category.name).filter(Boolean)
}

function sourceCategoryNames(brief: AiGenerationBrief): string[] {
  return brief.examples
    .map((example) => {
      const categoryName = (example as { categoryName?: unknown }).categoryName
      return typeof categoryName === 'string' ? exactAvailableCategory(brief, categoryName) : null
    })
    .filter((categoryName): categoryName is string => !!categoryName)
}

function weightedCategoryFallback(sectionName: string): string[] {
  switch (normalizeLabel(sectionName)) {
    case 'verbal reasoning':
      return [
        'Reading Comprehension',
        'Reading Comprehension',
        "True, False, Can't Tell",
      ]
    case 'decision making':
      return [
        'Syllogisms',
        'Syllogisms',
        'Logical Puzzles',
        'Recognising Assumptions',
        'Probabilistic and Statistical Reasoning',
        'Venn Diagrams',
      ]
    case 'quantitative reasoning':
      return [
        'Data Tables',
        'Data Tables',
        'Graphs and Charts',
        'Mixed Data Sources',
        'Text-Only Scenarios',
        'Timetables and Calendars',
        'Maps and Diagrams',
      ]
    case 'situational judgement':
      return [
        'How Appropriate',
        'How Important',
      ]
    default:
      return []
  }
}

function plannedCategoryName(brief: AiGenerationBrief, runIndex: number): string | null {
  if (brief.categoryName) return brief.categoryName

  const available = availableCategoryNames(brief)
  if (available.length === 0) return null

  const isQr = normalizeLabel(brief.sectionName) === 'quantitative reasoning'
  const sourceWeighted = sourceCategoryNames(brief)
  if (isQr) {
    const sourceDiversity = new Set(sourceWeighted.map(normalizeLabel)).size
    if (sourceDiversity >= 2) {
      return pick(sourceWeighted, `${brief.sectionName}:source-format:${runIndex}`) ?? pick(available, `${runIndex}`) ?? null
    }
  }

  if (!isQr && sourceWeighted.length > 0) {
    return pick(sourceWeighted, `${brief.sectionName}:source:${runIndex}`) ?? pick(available, `${runIndex}`) ?? null
  }

  const fallbackWeighted = weightedCategoryFallback(brief.sectionName)
    .map((name) => exactAvailableCategory(brief, name))
    .filter((name): name is string => !!name)

  return pick(fallbackWeighted.length > 0 ? fallbackWeighted : available, `${brief.sectionName}:fallback:${runIndex}`)
}

function naturalDifficultyIntent(target: DifficultyTarget, runIndex: number): DifficultyTarget {
  return target
}

function naturalTimeBurdenIntent(target: TimeBurdenTarget, runIndex: number): TimeBurdenTarget {
  return target
}

function sectionRealismPlan(brief: AiGenerationBrief, categoryName: string | null, runIndex: number): Record<string, string> {
  const section = normalizeLabel(brief.sectionName)
  const category = normalizeLabel(categoryName)
  const hasEnoughExamples = brief.examples.length >= 3

  if (section === 'quantitative reasoning') {
    return {
      categoryRole: brief.categoryName
        ? 'selected category is a targeted-practice constraint'
        : 'planned category is a soft source-format intent for source-example retrieval only; final category remains metadata/classification after writing',
      ...(hasEnoughExamples
        ? {}
        : {
            realismFallback:
              'Source examples are thin, so use a compact realistic UCAT-style data source with plausible arithmetic, units, rounding, and distractors; avoid repeating a fixed source or calculation template.',
          }),
    }
  }

  if (section === 'verbal reasoning') {
    return {
      questionMix: category === "true, false, can't tell"
        ? 'four statements testing true, false, and not-given distinctions without repeating the same trap'
        : 'four varied comprehension questions testing detail, local inference, author meaning, and support',
      ...(hasEnoughExamples
        ? {}
        : {
            realismFallback:
              'Source examples are thin, so write a compact official-style passage with concrete details and varied evidence locations; avoid a repeated passage formula.',
          }),
    }
  }

  if (section === 'decision making') {
    return {
      categoryRole: 'must fit this Decision Making category, but vary scenario domain and reasoning structure',
      ...(hasEnoughExamples
        ? {}
        : {
            realismFallback:
              category === 'logical puzzles'
                ? 'Source examples are thin, so use a natural official-style rule structure with one unambiguous solution path; avoid cycling through a fixed puzzle archetype.'
                : category === 'venn diagrams'
                  ? 'Source examples are thin, so use a clear official-style set relationship or diagram only where it genuinely supports the reasoning; avoid a fixed visual template.'
                  : 'Source examples are thin, so vary the reasoning structure and scenario naturally within the selected Decision Making category.',
          }),
    }
  }

  if (section === 'situational judgement') {
    return {
      judgementMode: categoryName ?? 'How Appropriate or How Important',
      ...(hasEnoughExamples
        ? {}
        : {
            realismFallback:
              'Source examples are thin, so use a realistic clinical or training context with nuanced professional judgement; avoid reusing a fixed scenario focus.',
          }),
    }
  }

  return {}
}

function defaultQuestionArchetype(brief: AiGenerationBrief, categoryName: string | null, runIndex: number): string {
  const section = normalizeLabel(brief.sectionName)
  if (section === 'quantitative reasoning') {
    return brief.examples.length >= 3
      ? 'derive the question style from source examples'
      : 'interpret a compact realistic source and perform efficient UCAT-style arithmetic'
  }
  if (section === 'verbal reasoning') {
    return normalizeLabel(categoryName) === "true, false, can't tell"
      ? 'assess passage-supported truth, contradiction, and not-given statements'
      : 'answer varied passage comprehension questions from textual evidence'
  }
  if (section === 'decision making') {
    return categoryName ?? 'Decision Making reasoning item'
  }
  if (section === 'situational judgement') {
    return categoryName ?? 'Situational Judgement professional judgement item'
  }
  return 'UCAT-style reasoning item'
}

function defaultDistractorPlan(brief: AiGenerationBrief, runIndex: number): string {
  const section = normalizeLabel(brief.sectionName)
  if (section === 'quantitative reasoning') {
    return brief.examples.length >= 3
      ? 'derive plausible distractor style from source examples'
      : 'plausible UCAT calculation traps based on the generated source'
  }
  if (section === 'verbal reasoning') return 'overstatement, reversed relationship, outside knowledge, partial match, and not-given traps'
  if (section === 'decision making') return 'necessary/sufficient confusion, ignored constraint, reversed condition, invalid inference, or plausible but unsupported option'
  if (section === 'situational judgement') return 'plausible actions separated by patient safety, professionalism, escalation, confidentiality, and scope-of-practice nuance'
  return 'plausible distractors based on the section rules'
}

export function buildLocalPlan(brief: AiGenerationBrief, runIndex: number): Record<string, unknown> {
  const categoryName = plannedCategoryName(brief, runIndex)
  const difficultyIntent = naturalDifficultyIntent(brief.difficultyTarget, runIndex)
  const timeBurdenIntent = naturalTimeBurdenIntent(brief.timeBurdenTarget, runIndex)

  return {
    plans: [
      {
        stemIndex: runIndex,
        categoryName,
        scenarioDomain: brief.examples.length >= 3
          ? 'derive naturally from source examples without copying their scenario'
          : 'choose a natural official-style scenario with no specialist outside knowledge',
        questionArchetype: defaultQuestionArchetype(brief, categoryName, runIndex),
        distractorPlan: defaultDistractorPlan(brief, runIndex),
        difficultyTarget: difficultyIntent,
        timeBurdenTarget: timeBurdenIntent,
        ...sectionRealismPlan(brief, categoryName, runIndex),
        notes:
          'Create one distinct official-style UCAT item. Use source examples only for calibration; do not copy premises, values, names, wording, or data relationships.',
      },
    ],
  }
}
