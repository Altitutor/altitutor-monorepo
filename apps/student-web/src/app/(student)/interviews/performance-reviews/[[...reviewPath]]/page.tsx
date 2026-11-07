import { notFound } from "next/navigation";
import { StudentPerformanceReviewsPage } from "@/features/interviews/components/StudentPerformanceReviewsPage";

export default async function PerformanceReviewsPage({ params, searchParams }: { params: Promise<{ reviewPath?: string[] }>; searchParams: Promise<{ revision?: string }> }) {
  const { reviewPath = [] } = await params;
  if (reviewPath.length > 1) notFound();
  const { revision } = await searchParams;
  return <StudentPerformanceReviewsPage reviewId={reviewPath[0]} revision={typeof revision === "string" && /^\d+$/.test(revision) ? revision : undefined} />;
}
