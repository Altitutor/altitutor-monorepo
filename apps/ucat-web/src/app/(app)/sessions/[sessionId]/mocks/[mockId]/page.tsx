import { SessionMockDetailPage } from "@/features/sessions/components/session-mock-detail-page";

export default async function SessionMockDetailRoute(
  props: {
    params: Promise<{ sessionId: string; mockId: string }>;
  }
) {
  const params = await props.params;
  return (
    <SessionMockDetailPage
      sessionId={params.sessionId}
      mockId={params.mockId}
    />
  );
}
