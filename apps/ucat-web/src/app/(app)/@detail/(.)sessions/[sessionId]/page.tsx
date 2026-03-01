import { SessionDetailPage } from '@/features/sessions'

export default function SessionDetailIntercept({
  params,
}: {
  params: { sessionId: string }
}) {
  return <SessionDetailPage sessionId={params.sessionId} />
}
