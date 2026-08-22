import { UcatAuditBoardPage } from '@/features/ucat/audits/components/UcatAuditBoardPage'

export default async function UcatAuditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <UcatAuditBoardPage auditId={id} />
}
