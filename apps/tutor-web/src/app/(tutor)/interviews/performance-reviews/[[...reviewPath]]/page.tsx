import { notFound } from "next/navigation";
import { TutorPerformanceReviewsPage } from "@/features/interviews/components/TutorPerformanceReviewsPage";

export default async function PerformanceReviewsPage({ params }: { params: Promise<{ reviewPath?: string[] }> }) {
  const { reviewPath = [] } = await params;
  if (reviewPath.length > (reviewPath[0] === "templates" ? 2 : 1)) notFound();
  return <TutorPerformanceReviewsPage path={reviewPath} />;
}
