import { MockDetailPage } from "@/features/mocks";

export default async function MockDetailRoute(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ studyPlanTaskId?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  return (
    <MockDetailPage
      mockId={params.id}
      studyPlanTaskId={searchParams.studyPlanTaskId ?? null}
    />
  );
}
