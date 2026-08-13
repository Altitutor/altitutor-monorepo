export const QUESTION_RECONCILIATION_ISSUES = [
  {
    slug: 'missing-category',
    tabLabel: 'No category',
    title: 'Stems without a category',
    description:
      'Non-deleted question stems that do not have a category assigned.',
  },
  {
    slug: 'missing-explanation',
    tabLabel: 'No explanation',
    title: 'Questions without explanations',
    description:
      'Non-deleted questions that have no usable answer explanation on the question itself and do not have explanations on every answer option.',
  },
  {
    slug: 'downvoted-questions',
    tabLabel: 'Question feedback',
    title: 'Downvoted questions',
    description:
      'Questions with at least one unresolved student downvote on the question content (resolved feedback is excluded).',
  },
  {
    slug: 'downvoted-explanations',
    tabLabel: 'Explanation feedback',
    title: 'Downvoted explanations',
    description:
      'Questions with at least one unresolved student downvote on the answer explanation (resolved feedback is excluded).',
  },
  {
    slug: 'untagged',
    tabLabel: 'Untagged',
    title: 'Untagged questions',
    description:
      'Non-deleted questions that have no taxonomy tags attached.',
  },
  {
    slug: 'private-not-in-set',
    tabLabel: 'Unused private',
    title: 'Unused private stems',
    description:
      'Private stems with no attachment to a question set, learning module, or session. Stems already used in any of those places are excluded — attach orphans somewhere useful or make them public.',
  },
  {
    slug: 'in-multiple-sets',
    tabLabel: 'Multiple sets',
    title: 'Questions in multiple sets',
    description:
      'Question stems attached to two or more question sets. Membership is stem-level (all questions under the stem share the same sets) — remove the stem from extra sets until it belongs to one.',
  },
  {
    slug: 'duplicates',
    tabLabel: 'Duplicates',
    title: 'Duplicate stems',
    description:
      'Exact normalized stem matches and high-confidence near copies (same question fingerprint, stem similarity ≥ 0.95). Merge is available for exact matches only; near copies can be deleted or kept. Dismissed “keep both” pairs are excluded.',
  },
] as const

export type QuestionIssueSlug =
  (typeof QUESTION_RECONCILIATION_ISSUES)[number]['slug']

export function isQuestionIssueSlug(value: string): value is QuestionIssueSlug {
  return QUESTION_RECONCILIATION_ISSUES.some((issue) => issue.slug === value)
}

export function getQuestionIssueDefinition(slug: QuestionIssueSlug) {
  return QUESTION_RECONCILIATION_ISSUES.find((issue) => issue.slug === slug)!
}
