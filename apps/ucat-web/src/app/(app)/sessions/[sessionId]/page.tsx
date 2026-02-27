import { SessionDetailPage } from '@/features/sessions'

export default function SessionDetailRoute({
  params,
}: {
  params: { sessionId: string }
}) {
  return <SessionDetailPage sessionId={params.sessionId} />
}

