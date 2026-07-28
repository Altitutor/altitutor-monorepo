'use client'

import dynamic from 'next/dynamic'
import { useUcatReconciliationHandlers } from './UcatReconciliationContext'
import { ReconciliationSubtypeTabs } from './ReconciliationSubtypeTabs'
import {
  QUESTION_RECONCILIATION_ISSUES,
  type QuestionIssueSlug,
} from '@/features/ucat/reconciliation/lib/question-issue-definitions'

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

export function UcatReconciliationQuestionIssue({
  issue,
}: {
  issue: QuestionIssueSlug
}) {
  const { onOpenStemDialog, onEditSet } = useUcatReconciliationHandlers()

  return (
    <div className="space-y-6">
      <ReconciliationSubtypeTabs
        items={QUESTION_RECONCILIATION_ISSUES}
        activeSlug={issue}
        baseHref="/ucat/reconciliation/questions"
        label="Question reconciliation issue types"
      />

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
