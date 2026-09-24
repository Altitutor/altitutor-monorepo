export const SET_RECONCILIATION_ISSUES = [
  {
    slug: 'question-count',
    tabLabel: 'Question count',
    title: 'Sets with incorrect number of questions',
    description:
      'Single-section sets whose question count does not match that section’s expected question count. Multi-section sets are excluded here.',
    dataKey: 'setsWithIncorrectQuestionCount',
    showTimeColumn: false,
  },
  {
    slug: 'timing',
    tabLabel: 'Timing',
    title: 'Sets with incorrect timing',
    description:
      'Timed sets whose time limit is a partial or full mismatch versus section expectations. Untimed sets are excluded; sets that only mismatch on question count (while time still matches) are also excluded.',
    dataKey: 'setsWithIncorrectTiming',
    showTimeColumn: true,
  },
  {
    slug: 'multiple-sections',
    tabLabel: 'Multiple sections',
    title: 'Sets with more than one section',
    description:
      'Question sets that span more than one UCAT section. Sets are expected to contain stems from a single section.',
    dataKey: 'setsWithMultipleSections',
    showTimeColumn: false,
  },
] as const

export type SetIssueSlug = (typeof SET_RECONCILIATION_ISSUES)[number]['slug']

export function isSetIssueSlug(value: string): value is SetIssueSlug {
  return SET_RECONCILIATION_ISSUES.some((issue) => issue.slug === value)
}

export function getSetIssueDefinition(slug: SetIssueSlug) {
  return SET_RECONCILIATION_ISSUES.find((issue) => issue.slug === slug)!
}

export const MOCK_RECONCILIATION_DESCRIPTION =
  'Mocks whose set count does not equal the number of UCAT sections, or whose sets are not ordered to match sections 1…N by section number.'
