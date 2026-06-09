import { LearningLessonPage } from "@/features/learning/components/learning-lesson-page";

type PageProps = {
  params: Promise<{ moduleId: string }>;
};

export default async function LearnLessonRoute({ params }: PageProps) {
  const { moduleId } = await params;
  return <LearningLessonPage lessonId={moduleId} />;
}
