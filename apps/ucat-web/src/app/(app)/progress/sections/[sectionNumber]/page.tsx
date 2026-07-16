import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { SectionProgressPage } from "@/features/progress";

type PageProps = {
  params: Promise<{ sectionNumber: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sectionNumber } = await params;
  const num = parseInt(sectionNumber, 10);
  if (Number.isNaN(num) || num < 1 || num > 4) {
    notFound();
  }
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <SectionProgressPage sectionNumber={num} />
    </Suspense>
  );
}
