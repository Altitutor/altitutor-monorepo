import { AttemptPreviewPage } from "@/features/progress/components/attempt-preview-page";
import { requireDevelopmentPreview } from "@/features/development-preview/lib/development-preview";

export default function AttemptPreviewRoute() {
  requireDevelopmentPreview();
  return <AttemptPreviewPage />;
}
