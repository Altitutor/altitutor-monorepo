'use client'

import type React from 'react'
import dynamic from 'next/dynamic'
import { useUcatReconciliationHandlers } from './UcatReconciliationContext'
import { ReconciliationSubtypeTabs } from './ReconciliationSubtypeTabs'
import {
  QUESTION_RECONCILIATION_ISSUES,
  type QuestionIssueSlug,
} from '@/features/ucat/reconciliation/lib/question-issue-definitions'
import { useQuestionIssueCounts } from '@/features/ucat/reconciliation/hooks/useReconciliationIssueCounts'

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
const StemsInMultipleSetsTable = dynamic(() =>
  import('./StemsInMultipleSetsTable').then((module) => module.StemsInMultipleSetsTable),
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
  const counts = useQuestionIssueCounts()

  let content: React.ReactNode
  switch (issue) {
    case 'missing-category':
      content = (
        <StemsWithNoCategoryTable
          onOpenStemDialog={onOpenStemDialog}
          showCountBadge={false}
        />
      )
      break
    case 'missing-explanation':
      content = (
        <QuestionsWithNoExplanationTable
          onOpenStemDialog={onOpenStemDialog}
          showCountBadge={false}
        />
      )
      break
    case 'downvoted-questions':
      content = (
        <DownvotedQuestionsTable
          onOpenStemDialog={onOpenStemDialog}
          showCountBadge={false}
        />
      )
      break
    case 'downvoted-explanations':
      content = (
        <DownvotedExplanationsTable
          onOpenStemDialog={onOpenStemDialog}
          showCountBadge={false}
        />
      )
      break
    case 'untagged':
      content = (
        <UntaggedQuestionsTable
          onOpenStemDialog={onOpenStemDialog}
          showCountBadge={false}
        />
      )
      break
    case 'private-not-in-set':
      content = (
        <PrivateStemsNotInSetTable
          onOpenStemDialog={onOpenStemDialog}
          onEditSet={onEditSet}
          showCountBadge={false}
        />
      )
      break
    case 'in-multiple-sets':
      content = (
        <StemsInMultipleSetsTable
          onOpenStemDialog={onOpenStemDialog}
          onEditSet={onEditSet}
          showCountBadge={false}
        />
      )
      break
    case 'duplicates':
      content = <PotentialDuplicatesTable showCountBadge={false} />
      break
    default: {
      const _exhaustive: never = issue
      return _exhaustive
    }
  }

  return (
    <div className="space-y-6">
      <ReconciliationSubtypeTabs
        items={QUESTION_RECONCILIATION_ISSUES}
        activeSlug={issue}
        baseHref="/ucat/reconciliation/questions"
        label="Question reconciliation issue types"
        counts={counts}
      />
      {content}
    </div>
  )
}
