'use client'

import { AlertCircle } from 'lucide-react'
import { SkeletonTable } from '@altitutor/ui'
import { StemsWithNoCategoryTable } from '@/features/ucat/reconciliation/components/StemsWithNoCategoryTable'
import { QuestionsWithNoExplanationTable } from '@/features/ucat/reconciliation/components/QuestionsWithNoExplanationTable'
import { UntaggedQuestionsTable } from '@/features/ucat/reconciliation/components/UntaggedQuestionsTable'
import { PrivateStemsNotInSetTable } from '@/features/ucat/reconciliation/components/PrivateStemsNotInSetTable'
import { SetsReconciliationTable } from '@/features/ucat/reconciliation/components/SetsReconciliationTable'
import { MocksWithIncorrectSetsTable } from '@/features/ucat/reconciliation/components/MocksWithIncorrectSetsTable'
import { useUcatReconciliationHandlers } from '@/features/ucat/reconciliation/components/UcatReconciliationContext'
import { useReconciliationData } from '@/features/ucat/reconciliation/hooks/useReconciliation'

function QuestionsTabSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-busy="true">
      <SkeletonTable rows={3} columns={5} />
      <SkeletonTable rows={3} columns={5} />
      <SkeletonTable rows={3} columns={5} />
      <SkeletonTable rows={3} columns={5} />
    </div>
  )
}

function SetsTabSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-busy="true">
      <SkeletonTable rows={3} columns={6} />
      <SkeletonTable rows={3} columns={6} />
      <SkeletonTable rows={3} columns={5} />
    </div>
  )
}

function MocksTabSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-busy="true">
      <SkeletonTable rows={3} columns={4} />
    </div>
  )
}

function TabError({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-md border border-destructive bg-destructive/10 p-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-5 w-5" />
        <p>{message}</p>
      </div>
    </div>
  )
}

function questionsTabCount(data: NonNullable<ReturnType<typeof useReconciliationData>['data']>) {
  return (
    data.stemsWithNoCategory.length +
    data.questionsWithNoExplanation.length +
    data.untaggedQuestions.length +
    data.privateStemsNotInSet.length
  )
}

function setsTabCount(data: NonNullable<ReturnType<typeof useReconciliationData>['data']>) {
  return (
    data.setsWithIncorrectQuestionCount.length +
    data.setsWithIncorrectTiming.length +
    data.setsWithMultipleSections.length
  )
}

export function UcatReconciliationQuestionsTab() {
  const { onOpenStemDialog } = useUcatReconciliationHandlers()
  const { data, isLoading, isError } = useReconciliationData()

  if (isLoading) return <QuestionsTabSkeleton />
  if (isError) {
    return <TabError message="Error loading question reconciliation data. Please try again." />
  }
  if (!data || questionsTabCount(data) === 0) return null

  return (
    <div className="mt-6 space-y-8">
      <StemsWithNoCategoryTable onOpenStemDialog={onOpenStemDialog} />
      <QuestionsWithNoExplanationTable onOpenStemDialog={onOpenStemDialog} />
      <UntaggedQuestionsTable onOpenStemDialog={onOpenStemDialog} />
      <PrivateStemsNotInSetTable onOpenStemDialog={onOpenStemDialog} />
    </div>
  )
}

export function UcatReconciliationSetsTab() {
  const { onEditSet } = useUcatReconciliationHandlers()
  const { data, isLoading, isError } = useReconciliationData()

  if (isLoading) return <SetsTabSkeleton />
  if (isError) {
    return <TabError message="Error loading set reconciliation data. Please try again." />
  }
  if (!data || setsTabCount(data) === 0) return null

  return (
    <div className="mt-6 space-y-8">
      <SetsReconciliationTable
        title="Sets with incorrect number of questions"
        dataKey="setsWithIncorrectQuestionCount"
        onEditSet={onEditSet}
      />
      <SetsReconciliationTable
        title="Sets with incorrect timing"
        dataKey="setsWithIncorrectTiming"
        onEditSet={onEditSet}
        showTimeColumn
      />
      <SetsReconciliationTable
        title="Sets with more than 1 section"
        dataKey="setsWithMultipleSections"
        onEditSet={onEditSet}
      />
    </div>
  )
}

export function UcatReconciliationMocksTab() {
  const { onEditMock } = useUcatReconciliationHandlers()
  const { data, isLoading, isError } = useReconciliationData()

  if (isLoading) return <MocksTabSkeleton />
  if (isError) {
    return <TabError message="Error loading mock reconciliation data. Please try again." />
  }
  if (!data || data.mocksWithIncorrectSets.length === 0) return null

  return (
    <div className="mt-6 space-y-8">
      <MocksWithIncorrectSetsTable onEditMock={onEditMock} />
    </div>
  )
}
