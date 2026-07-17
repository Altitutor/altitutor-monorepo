import { notFound } from "next/navigation";
import { StudyPlanPreviewPage } from "@/features/study-plan/components/study-plan-preview-page";

export default function StudyPlanPreviewRoute() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <StudyPlanPreviewPage />;
}
