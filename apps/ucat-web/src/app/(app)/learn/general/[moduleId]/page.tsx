import { LearningLessonPage } from "@/features/learning";

type PageProps = {
  params: Promise<{ moduleId: string }>;
};

export default async function LearnGeneralLessonRoute({ params }: PageProps) {
  const { moduleId } = await params;
  return <LearningLessonPage lessonId={moduleId} sectionNumber={null} />;
}
