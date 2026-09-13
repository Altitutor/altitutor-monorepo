import { MockDetailPage } from "@/features/mocks";

export default function MockDetailRoute({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { studyPlanTaskId?: string };
}) {
  return (
    <MockDetailPage
      mockId={params.id}
      studyPlanTaskId={searchParams.studyPlanTaskId ?? null}
    />
  );
}
