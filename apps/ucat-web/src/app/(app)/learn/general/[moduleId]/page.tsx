import { LearningLessonPage } from "@/features/learning";

type PageProps = {
  params: Promise<{ moduleId: string }>;
  searchParams: Promise<{ studyPlanTaskId?: string }>;
};

export default async function LearnGeneralLessonRoute({
  params,
  searchParams,
}: PageProps) {
  const { moduleId } = await params;
  const { studyPlanTaskId = null } = await searchParams;
  return (
    <LearningLessonPage
      lessonId={moduleId}
      sectionNumber={null}
      studyPlanTaskId={studyPlanTaskId}
    />
  );
}
