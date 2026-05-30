import { SessionSetDetailPage } from "@/features/sessions/components/session-set-detail-page";

export default function SessionSetDetailRoute({
  params,
}: {
  params: { sessionId: string; setId: string };
}) {
  return (
    <SessionSetDetailPage sessionId={params.sessionId} setId={params.setId} />
  );
}
