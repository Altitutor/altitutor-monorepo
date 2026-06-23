import type { AiGenerationBrief } from './prompts'

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/gu, ' ')
}

function mixedTarget(index: number, values: string[]): string {
  return values[index % values.length] ?? values[0] ?? 'medium'
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
    { puzzleArchetype: 'scheduling with time windows', scenarioDomain: 'appointments or events', questionFocus: 'must be true' },
    { puzzleArchetype: 'allocation with exclusions', scenarioDomain: 'people assigned to tasks or resources', questionFocus: 'complete one assignment' },
    { puzzleArchetype: 'ordering with relative constraints', scenarioDomain: 'objects or events, not ages or race positions', questionFocus: 'could be true' },
    { puzzleArchetype: 'conditional eligibility', scenarioDomain: 'selection under necessary and sufficient rules', questionFocus: 'identify the only eligible option' },
    { puzzleArchetype: 'seating or adjacency', scenarioDomain: 'linear or circular arrangement', questionFocus: 'cannot be true' },
    { puzzleArchetype: 'coded symbols or transformations', scenarioDomain: 'abstract labels or operations', questionFocus: 'apply the rule' },
  ]
  return plans[index % plans.length] ?? plans[0]
}

function vennDiagramDiversityPlan(index: number): Record<string, string> {
  const plans = [
    {
      vennVisualFormat: 'irregular overlapping set diagram using triangle, circle, pentagon, and diamond shapes with a separate legend',
      questionArchetype: 'interpret which statement must be true from a completed set diagram',
    },
    {
      vennVisualFormat: 'answer options are four compact monochrome three-set Venn diagrams in boxes',
      questionArchetype: 'choose the diagram that correctly represents the written scenario',
    },
    {
      vennVisualFormat: 'nested and overlapping ellipses/rectangles with region numbers and little or no colour',
      questionArchetype: 'calculate a total or compare two set memberships',
    },
    {
      vennVisualFormat: 'two-set or three-set diagram with one set partly inside another and one crossing set',
      questionArchetype: 'identify the only statement supported by the diagram',
    },
    {
      vennVisualFormat: 'four-shape set diagram using a rectangle, triangle, circle, and hexagon with overlapping regions',
      questionArchetype: 'compare only/at least one/both categories from region values',
    },
  ]
  return plans[index % plans.length] ?? plans[0]
}

export function buildLocalPlan(brief: AiGenerationBrief, runIndex: number): Record<string, unknown> {
  const categories =
    brief.categoryName || !brief.availableCategories?.length
      ? []
      : brief.availableCategories.map((category) => category.name)
  return {
    plans: Array.from({ length: brief.stemCount }, (_, index) => ({
      stemIndex: runIndex + index,
      categoryName: brief.categoryName ?? categories[index % Math.max(1, categories.length)] ?? null,
      difficultyTarget:
        brief.difficultyTarget === 'mixed'
          ? mixedTarget(runIndex + index, ['medium', 'medium', 'easy', 'hard', 'medium'])
          : brief.difficultyTarget,
      timeBurdenTarget:
        brief.timeBurdenTarget === 'mixed'
          ? mixedTarget(runIndex + index, ['medium', 'medium', 'low', 'high', 'medium'])
          : brief.timeBurdenTarget,
      correctAnswerPattern: correctAnswerPattern(brief.categoryName, runIndex + index),
      ...(normalizeLabel(brief.categoryName) === 'logical puzzles'
        ? logicalPuzzleDiversityPlan(runIndex + index)
        : {}),
      ...(normalizeLabel(brief.categoryName) === 'venn diagrams'
        ? vennDiagramDiversityPlan(runIndex + index)
        : {}),
      notes: 'Create a distinct official-style UCAT item; do not copy source examples.',
    })),
  }
}
