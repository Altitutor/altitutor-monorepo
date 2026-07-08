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
  if (normalizeLabel(brief.sectionName) === 'quantitative reasoning') return null

  const available = availableCategoryNames(brief)
  if (available.length === 0) return null

  const sourceWeighted = sourceCategoryNames(brief)
  if (sourceWeighted.length > 0) {
    return pick(sourceWeighted, `${brief.sectionName}:source:${runIndex}`) ?? pick(available, `${runIndex}`) ?? null
  }

  const fallbackWeighted = weightedCategoryFallback(brief.sectionName)
    .map((name) => exactAvailableCategory(brief, name))
    .filter((name): name is string => !!name)

  return pick(fallbackWeighted.length > 0 ? fallbackWeighted : available, `${brief.sectionName}:fallback:${runIndex}`)
}

function naturalDifficultyIntent(target: DifficultyTarget, runIndex: number): DifficultyTarget {
  if (target !== 'mixed') return target
  const intents: DifficultyTarget[] = ['mixed', 'medium', 'medium', 'easy', 'hard', 'mixed', 'medium']
  return intents[runIndex % intents.length] ?? 'mixed'
}

function naturalTimeBurdenIntent(target: TimeBurdenTarget, runIndex: number): TimeBurdenTarget {
  if (target !== 'mixed') return target
  const intents: TimeBurdenTarget[] = ['mixed', 'medium', 'medium', 'low', 'high', 'mixed', 'medium']
  return intents[runIndex % intents.length] ?? 'mixed'
}

export function correctAnswerPattern(categoryName: string | null, index: number): string[] {
  if (normalizeLabel(categoryName) === "true, false, can't tell") {
    const patterns = [
      ['True', 'False', "Can't Tell", 'True'],
      ['False', "Can't Tell", 'True', 'False'],
      ["Can't Tell", 'True', 'False', "Can't Tell"],
    ]
    return patterns[index % patterns.length] ?? patterns[0]
  }
  const patterns = [
    ['B', 'D', 'A', 'C'],
    ['C', 'A', 'D', 'B'],
    ['D', 'B', 'C', 'A'],
    ['A', 'C', 'B', 'D'],
  ]
  return patterns[index % patterns.length] ?? patterns[0]
}

function logicalPuzzleDiversityPlan(index: number): Record<string, string> {
  const plans = [
    { puzzleArchetype: 'scheduling with time windows', scenarioDomain: 'appointments, lessons, events, or shifts', questionFocus: 'must be true' },
    { puzzleArchetype: 'allocation with exclusions', scenarioDomain: 'people assigned to tasks, rooms, projects, teams, or resources', questionFocus: 'complete one assignment' },
    { puzzleArchetype: 'ordering with relative constraints', scenarioDomain: 'routes, performances, rankings, deliveries, or submissions', questionFocus: 'could be true' },
    { puzzleArchetype: 'conditional eligibility', scenarioDomain: 'selection under necessary and sufficient rules', questionFocus: 'identify the only eligible option' },
    { puzzleArchetype: 'seating or adjacency', scenarioDomain: 'linear or circular arrangement with social or procedural constraints', questionFocus: 'cannot be true' },
    { puzzleArchetype: 'coded symbols or transformations', scenarioDomain: 'abstract labels, operations, or rule application', questionFocus: 'apply the rule' },
  ]
  return plans[index % plans.length] ?? plans[0]
}

function vennDiagramDiversityPlan(index: number): Record<string, string> {
  const plans = [
    {
      vennVisualFormat: 'irregular overlapping set diagram using mixed monochrome shapes with a separate legend',
      questionArchetype: 'interpret which statement must be true from a completed set diagram',
    },
    {
      vennVisualFormat: 'answer options are four compact monochrome set diagrams in boxes',
      questionArchetype: 'choose the diagram that correctly represents the written scenario',
    },
    {
      vennVisualFormat: 'nested and overlapping ellipses or rectangles with region numbers and little or no colour',
      questionArchetype: 'calculate a total or compare two set memberships',
    },
    {
      vennVisualFormat: 'two-set or three-set diagram with one set partly inside another and one crossing set',
      questionArchetype: 'identify the only statement supported by the diagram',
    },
    {
      vennVisualFormat: 'four-shape set diagram using a rectangle, triangle, circle, and polygon with overlapping regions',
      questionArchetype: 'compare only, at least one, both, or neither categories from region values',
    },
  ]
  return plans[index % plans.length] ?? plans[0]
}

function sectionRealismPlan(brief: AiGenerationBrief, categoryName: string | null, runIndex: number): Record<string, string> {
  const section = normalizeLabel(brief.sectionName)
  const category = normalizeLabel(categoryName)

  if (section === 'quantitative reasoning') {
    const qrSources = [
      'shared compact data source with 2-4 linked questions',
      'standalone table, chart, rate card, or short text source with one focused question',
      'hybrid source combining a small table with rules, rates, dates, or a visual',
      'image-like source encoded as deterministic structured data when needed',
    ]
    const operations = [
      'read exact value plus one arithmetic step',
      'percentage change, proportion, or ratio with plausible rounding',
      'unit conversion or rate calculation',
      'compare cheapest, largest, smallest, average, or difference using the correct denominator',
      'combine two parts of the source without overloading the stem',
    ]
    return {
      sourcePattern: pick(qrSources, `qr-source:${runIndex}`) ?? qrSources[0],
      calculationPattern: pick(operations, `qr-op:${runIndex}`) ?? operations[0],
      categoryRole: brief.categoryName
        ? 'selected category is a targeted-practice constraint'
        : 'category is metadata/classification; realistic mixed or borderline sources are allowed',
    }
  }

  if (section === 'verbal reasoning') {
    return {
      passageSourceStyle: pick([
        'compact article excerpt',
        'neutral commentary with concrete evidence',
        'factual report with named entities and dates',
        'short explanatory passage with competing causes or consequences',
      ], `vr-style:${runIndex}`) ?? 'compact article excerpt',
      questionMix: category === "true, false, can't tell"
        ? 'four statements testing true, false, and not-given distinctions without repeating the same trap'
        : 'four varied comprehension questions testing detail, local inference, author meaning, and support',
    }
  }

  if (section === 'decision making') {
    return {
      categoryRole: 'must fit this Decision Making category, but vary scenario domain and reasoning structure',
      ...(category === 'logical puzzles' ? logicalPuzzleDiversityPlan(runIndex) : {}),
      ...(category === 'venn diagrams' ? vennDiagramDiversityPlan(runIndex) : {}),
    }
  }

  if (section === 'situational judgement') {
    return {
      judgementMode: categoryName ?? pick(['How Appropriate', 'How Important'], `sj:${runIndex}`) ?? 'How Appropriate',
      scenarioFocus: pick([
        'patient safety and escalation',
        'confidentiality and respectful communication',
        'honesty, mistakes, and professional integrity',
        'teamwork, scope of practice, and seeking help',
        'student placement boundaries and supervision',
      ], `sj-focus:${runIndex}`) ?? 'patient safety and escalation',
    }
  }

  return {}
}

function defaultQuestionArchetype(brief: AiGenerationBrief, categoryName: string | null, runIndex: number): string {
  const section = normalizeLabel(brief.sectionName)
  if (section === 'quantitative reasoning') {
    return pick([
      'interpret a compact source and perform one or two timed arithmetic steps',
      'compare values across source rows, columns, groups, or time periods',
      'combine a rate, percentage, ratio, or unit conversion with source reading',
      'select the cheapest, largest, smallest, difference, average, or proportion from the source',
    ], `archetype:${section}:${runIndex}`) ?? 'interpret a compact source and perform one or two timed arithmetic steps'
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
    return pick([
      'wrong denominator, percentage-point confusion, or inverse ratio',
      'correct operation applied to the wrong row, group, period, or unit',
      'plausible rounding choice plus one common arithmetic slip',
      'reading one source component correctly but missing a second condition',
    ], `distractor:${section}:${runIndex}`) ?? 'plausible UCAT calculation traps'
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
        scenarioDomain: pick([
          'ordinary real-world context',
          'education, work, public services, travel, retail, health, sport, or community setting',
          'compact official-style scenario with no specialist outside knowledge',
        ], `scenario:${brief.sectionName}:${runIndex}`) ?? 'ordinary real-world context',
        questionArchetype: defaultQuestionArchetype(brief, categoryName, runIndex),
        distractorPlan: defaultDistractorPlan(brief, runIndex),
        difficultyTarget: difficultyIntent,
        timeBurdenTarget: timeBurdenIntent,
        correctAnswerPattern: correctAnswerPattern(categoryName, runIndex),
        ...sectionRealismPlan(brief, categoryName, runIndex),
        notes:
          'Create one distinct official-style UCAT item. Use source examples only for calibration; do not copy premises, values, names, wording, or data relationships.',
      },
    ],
  }
}
