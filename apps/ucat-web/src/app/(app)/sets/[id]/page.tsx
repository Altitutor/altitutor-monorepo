import { SetDetailPage } from "@/features/sets";

export default async function SetDetailRoute(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <SetDetailPage setId={params.id} />;
}
