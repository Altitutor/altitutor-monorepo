import { LearningLessonLegacyRedirect } from "@/features/learning/components/learning-lesson-legacy-redirect";

type PageProps = {
  params: Promise<{ moduleId: string }>;
};

export default async function LearnLessonRoute({ params }: PageProps) {
  const { moduleId } = await params;
  return <LearningLessonLegacyRedirect lessonId={moduleId} />;
}
