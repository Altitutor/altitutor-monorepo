import { notFound } from "next/navigation";
import { LearningLessonPage } from "@/features/learning";

type PageProps = {
  params: Promise<{ sectionNumber: string; moduleId: string }>;
};

export default async function LearnLessonRoute({ params }: PageProps) {
  const { sectionNumber, moduleId } = await params;
  const number = Number.parseInt(sectionNumber, 10);
  if (Number.isNaN(number) || number < 1 || number > 4) notFound();
  return <LearningLessonPage lessonId={moduleId} sectionNumber={number} />;
}
