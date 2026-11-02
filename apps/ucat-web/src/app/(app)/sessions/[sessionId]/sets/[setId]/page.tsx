import { SessionSetDetailPage } from "@/features/sessions/components/session-set-detail-page";

export default async function SessionSetDetailRoute(
  props: {
    params: Promise<{ sessionId: string; setId: string }>;
  }
) {
  const params = await props.params;
  return (
    <SessionSetDetailPage sessionId={params.sessionId} setId={params.setId} />
  );
}
