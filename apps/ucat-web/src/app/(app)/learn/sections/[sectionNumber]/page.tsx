import { notFound } from "next/navigation";
import { LearningSectionPage } from "@/features/learning";

type PageProps = {
  params: Promise<{ sectionNumber: string }>;
};

export default async function LearnSectionRoute({ params }: PageProps) {
  const { sectionNumber } = await params;
  const number = Number.parseInt(sectionNumber, 10);
  if (Number.isNaN(number) || number < 1 || number > 4) notFound();
  return <LearningSectionPage sectionNumber={number} />;
}
