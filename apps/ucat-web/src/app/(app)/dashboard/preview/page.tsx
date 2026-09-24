import { DashboardPreviewPage } from "@/features/dashboard/components/dashboard-preview-page";
import { requireDevelopmentPreview } from "@/features/development-preview/lib/development-preview";

export default function DashboardPreviewRoute() {
  requireDevelopmentPreview();
  return <DashboardPreviewPage />;
}
