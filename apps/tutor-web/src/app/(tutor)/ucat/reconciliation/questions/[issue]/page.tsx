import { notFound } from 'next/navigation'
import {
  isQuestionIssueSlug,
  UcatReconciliationQuestionIssue,
} from '@/features/ucat/reconciliation/components/UcatReconciliationQuestionIssues'

export default async function UcatReconciliationQuestionIssuePage({
  params,
}: {
  params: Promise<{ issue: string }>
}) {
  const { issue } = await params
  if (!isQuestionIssueSlug(issue)) notFound()
  return <UcatReconciliationQuestionIssue issue={issue} />
}
