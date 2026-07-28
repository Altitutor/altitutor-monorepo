'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/shared/utils'
import { tutorTableShell } from '@/shared/lib/tutor-visual'
import { useUcatReconciliationHandlers } from './UcatReconciliationContext'

const StemsWithNoCategoryTable = dynamic(() =>
  import('./StemsWithNoCategoryTable').then((module) => module.StemsWithNoCategoryTable),
)
const QuestionsWithNoExplanationTable = dynamic(() =>
  import('./QuestionsWithNoExplanationTable').then((module) => module.QuestionsWithNoExplanationTable),
)
const DownvotedQuestionsTable = dynamic(() =>
  import('./DownvotedQuestionsTable').then((module) => module.DownvotedQuestionsTable),
)
const DownvotedExplanationsTable = dynamic(() =>
  import('./DownvotedExplanationsTable').then((module) => module.DownvotedExplanationsTable),
)
const UntaggedQuestionsTable = dynamic(() =>
  import('./UntaggedQuestionsTable').then((module) => module.UntaggedQuestionsTable),
)
const PrivateStemsNotInSetTable = dynamic(() =>
  import('./PrivateStemsNotInSetTable').then((module) => module.PrivateStemsNotInSetTable),
)
const PotentialDuplicatesTable = dynamic(() =>
  import('./PotentialDuplicatesTable').then((module) => module.PotentialDuplicatesTable),
)

const ISSUES = [
  {
    slug: 'missing-category',
    title: 'Stems without a category',
    description: 'Assign a category to question stems that do not have one.',
  },
  {
    slug: 'missing-explanation',
    title: 'Questions without explanations',
    description: 'Review questions whose answer explanation is incomplete.',
  },
  {
    slug: 'downvoted-questions',
    title: 'Downvoted questions',
    description: 'Respond to unresolved learner feedback on question content.',
  },
  {
    slug: 'downvoted-explanations',
    title: 'Downvoted explanations',
    description: 'Respond to unresolved learner feedback on explanations.',
  },
  {
    slug: 'untagged',
    title: 'Untagged questions',
    description: 'Add taxonomy tags to questions that have none.',
  },
  {
    slug: 'private-not-in-set',
    title: 'Private stems not in a set',
    description: 'Add private stems to a set or make them public.',
  },
  {
    slug: 'duplicates',
    title: 'Exact duplicate stems',
    description: 'Compare stems with identical normalized text, then delete, merge, or keep both.',
  },
] as const

export type QuestionIssueSlug = (typeof ISSUES)[number]['slug']

export function UcatReconciliationQuestionIssuesOverview() {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {ISSUES.map((issue) => (
        <Link
          key={issue.slug}
          href={`/ucat/reconciliation/questions/${issue.slug}`}
          className={cn(
            tutorTableShell,
            'group flex items-start justify-between gap-4 p-5 transition-colors hover:border-primary/40',
          )}
        >
          <div>
            <h2 className="font-semibold">{issue.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{issue.description}</p>
          </div>
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      ))}
    </div>
  )
}

export function UcatReconciliationQuestionIssue({
  issue,
}: {
  issue: QuestionIssueSlug
}) {
  const { onOpenStemDialog, onEditSet } = useUcatReconciliationHandlers()

  return (
    <div className="mt-6 space-y-4">
      <Link
        href="/ucat/reconciliation/questions"
        className="inline-flex text-sm text-muted-foreground hover:text-foreground"
      >
        ← All question issues
      </Link>
      {issue === 'missing-category' ? (
        <StemsWithNoCategoryTable onOpenStemDialog={onOpenStemDialog} />
      ) : issue === 'missing-explanation' ? (
        <QuestionsWithNoExplanationTable onOpenStemDialog={onOpenStemDialog} />
      ) : issue === 'downvoted-questions' ? (
        <DownvotedQuestionsTable onOpenStemDialog={onOpenStemDialog} />
      ) : issue === 'downvoted-explanations' ? (
        <DownvotedExplanationsTable onOpenStemDialog={onOpenStemDialog} />
      ) : issue === 'untagged' ? (
        <UntaggedQuestionsTable onOpenStemDialog={onOpenStemDialog} />
      ) : issue === 'private-not-in-set' ? (
        <PrivateStemsNotInSetTable
          onOpenStemDialog={onOpenStemDialog}
          onEditSet={onEditSet}
        />
      ) : (
        <PotentialDuplicatesTable />
      )}
    </div>
  )
}

export function isQuestionIssueSlug(value: string): value is QuestionIssueSlug {
  return ISSUES.some((issue) => issue.slug === value)
}
