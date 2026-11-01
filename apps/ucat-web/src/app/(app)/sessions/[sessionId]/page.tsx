import { SessionDetailPage } from "@/features/sessions";

export default async function SessionDetailRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  return <SessionDetailPage sessionId={params.sessionId} />;
}
