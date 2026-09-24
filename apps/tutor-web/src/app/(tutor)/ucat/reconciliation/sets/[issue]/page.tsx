import { notFound } from 'next/navigation'
import { UcatReconciliationSetIssue } from '@/features/ucat/reconciliation/components/UcatReconciliationSetIssues'
import { isSetIssueSlug } from '@/features/ucat/reconciliation/lib/set-issue-definitions'

export default async function UcatReconciliationSetIssuePage({
  params,
}: {
  params: Promise<{ issue: string }>
}) {
  const { issue } = await params
  if (!isSetIssueSlug(issue)) notFound()
  return <UcatReconciliationSetIssue issue={issue} />
}
