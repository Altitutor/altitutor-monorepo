import { SetAttemptDetailPage } from "@/features/progress";

type PageProps = {
  params: Promise<{ sectionNumber: string; id: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sectionNumber, id } = await params;
  return (
    <SetAttemptDetailPage
      attemptId={id}
      backHref={`/progress/sections/${sectionNumber}`}
      backLabel="Back to section"
    />
  );
}
