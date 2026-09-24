import { requireDevelopmentPreview } from "@/features/development-preview/lib/development-preview";
import { InsightPreviewPage } from "@/features/insights/components/insight-preview-page";
import { INSIGHT_PREVIEW_CATALOG } from "@/features/insights/lib/insight-preview-catalog";

export default function InsightPreviewRoute() {
  requireDevelopmentPreview();
  return <InsightPreviewPage previews={INSIGHT_PREVIEW_CATALOG} />;
}
