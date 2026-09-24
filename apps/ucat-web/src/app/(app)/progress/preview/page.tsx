import { ProgressPreviewPage } from "@/features/progress/components/progress-preview-page";
import { requireDevelopmentPreview } from "@/features/development-preview/lib/development-preview";

export default function ProgressPreviewRoute() {
  requireDevelopmentPreview();
  return <ProgressPreviewPage />;
}
