import { SessionMockDetailPage } from "@/features/sessions/components/session-mock-detail-page";

export default function SessionMockDetailRoute({
  params,
}: {
  params: { sessionId: string; mockId: string };
}) {
  return (
    <SessionMockDetailPage
      sessionId={params.sessionId}
      mockId={params.mockId}
    />
  );
}
