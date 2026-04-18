import { SetAttemptDetailPage } from "@/features/progress";

type PageProps = {
  params: { id: string };
};

export default function Page({ params }: PageProps) {
  return <SetAttemptDetailPage attemptId={params.id} />;
}
