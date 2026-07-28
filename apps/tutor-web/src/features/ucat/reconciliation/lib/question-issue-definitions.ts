export const QUESTION_RECONCILIATION_ISSUES = [
  {
    slug: 'missing-category',
    tabLabel: 'No category',
    title: 'Stems without a category',
    description: 'Assign a category to question stems that do not have one.',
  },
  {
    slug: 'missing-explanation',
    tabLabel: 'No explanation',
    title: 'Questions without explanations',
    description: 'Review questions whose answer explanation is incomplete.',
  },
  {
    slug: 'downvoted-questions',
    tabLabel: 'Question feedback',
    title: 'Downvoted questions',
    description: 'Respond to unresolved learner feedback on question content.',
  },
  {
    slug: 'downvoted-explanations',
    tabLabel: 'Explanation feedback',
    title: 'Downvoted explanations',
    description: 'Respond to unresolved learner feedback on explanations.',
  },
  {
    slug: 'untagged',
    tabLabel: 'Untagged',
    title: 'Untagged questions',
    description: 'Add taxonomy tags to questions that have none.',
  },
  {
    slug: 'private-not-in-set',
    tabLabel: 'Private / no set',
    title: 'Private stems not in a set',
    description: 'Add private stems to a set or make them public.',
  },
  {
    slug: 'duplicates',
    tabLabel: 'Duplicates',
    title: 'Exact duplicate stems',
    description: 'Compare stems with identical normalized text, then delete, merge, or keep both.',
  },
] as const

export type QuestionIssueSlug =
  (typeof QUESTION_RECONCILIATION_ISSUES)[number]['slug']

export function isQuestionIssueSlug(value: string): value is QuestionIssueSlug {
  return QUESTION_RECONCILIATION_ISSUES.some((issue) => issue.slug === value)
}
