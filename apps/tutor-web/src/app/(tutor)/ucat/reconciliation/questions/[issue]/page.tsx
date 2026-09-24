import { notFound } from 'next/navigation'
import { UcatReconciliationQuestionIssue } from '@/features/ucat/reconciliation/components/UcatReconciliationQuestionIssues'
import { isQuestionIssueSlug } from '@/features/ucat/reconciliation/lib/question-issue-definitions'

export default async function UcatReconciliationQuestionIssuePage({
  params,
}: {
  params: Promise<{ issue: string }>
}) {
  const { issue } = await params
  if (!isQuestionIssueSlug(issue)) notFound()
  return <UcatReconciliationQuestionIssue issue={issue} />
}
