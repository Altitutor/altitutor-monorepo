import { notFound } from "next/navigation";
import { SetsListPage } from "@/features/sets";

type PageProps = {
  params: Promise<{ sectionNumber: string }>;
};

export default async function SetsSectionRoute({ params }: PageProps) {
  const { sectionNumber } = await params;
  const num = parseInt(sectionNumber, 10);
  if (Number.isNaN(num) || num < 1 || num > 4) {
    notFound();
  }
  return <SetsListPage sectionNumber={num} />;
}
