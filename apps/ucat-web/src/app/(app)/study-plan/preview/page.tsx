import { StudyPlanPreviewPage } from "@/features/study-plan/components/study-plan-preview-page";
import { requireDevelopmentPreview } from "@/features/development-preview/lib/development-preview";

export default function StudyPlanPreviewRoute() {
  requireDevelopmentPreview();
  return <StudyPlanPreviewPage />;
}
