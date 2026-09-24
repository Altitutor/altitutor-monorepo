import { LearningLessonLegacyRedirect } from "@/features/learning/components/learning-lesson-legacy-redirect";

type PageProps = {
  params: Promise<{ moduleId: string }>;
  searchParams: Promise<{ studyPlanTaskId?: string }>;
};

export default async function LearnLessonRoute({
  params,
  searchParams,
}: PageProps) {
  const { moduleId } = await params;
  const { studyPlanTaskId = null } = await searchParams;
  return (
    <LearningLessonLegacyRedirect
      lessonId={moduleId}
      studyPlanTaskId={studyPlanTaskId}
    />
  );
}
