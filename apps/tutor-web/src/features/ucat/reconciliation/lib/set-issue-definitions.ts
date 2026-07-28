export const SET_RECONCILIATION_ISSUES = [
  {
    slug: 'question-count',
    tabLabel: 'Question count',
    title: 'Sets with incorrect number of questions',
    dataKey: 'setsWithIncorrectQuestionCount',
    showTimeColumn: false,
  },
  {
    slug: 'timing',
    tabLabel: 'Timing',
    title: 'Sets with incorrect timing',
    dataKey: 'setsWithIncorrectTiming',
    showTimeColumn: true,
  },
  {
    slug: 'multiple-sections',
    tabLabel: 'Multiple sections',
    title: 'Sets with more than one section',
    dataKey: 'setsWithMultipleSections',
    showTimeColumn: false,
  },
] as const

export type SetIssueSlug = (typeof SET_RECONCILIATION_ISSUES)[number]['slug']

export function isSetIssueSlug(value: string): value is SetIssueSlug {
  return SET_RECONCILIATION_ISSUES.some((issue) => issue.slug === value)
}
