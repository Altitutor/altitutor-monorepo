import { PreparationSandboxPage } from "@/features/preparation/components/preparation-sandbox-page";
import { requireDevelopmentPreview } from "@/features/development-preview/lib/development-preview";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loadDevelopmentCatalogSandboxCase } from "@/features/study-plan/server/study-plan-service";

export default async function StudyPlanPreviewRoute() {
  requireDevelopmentPreview();
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const catalogCase = user
    ? await loadDevelopmentCatalogSandboxCase(supabase, user.id)
    : null;
  return <PreparationSandboxPage catalogCase={catalogCase} />;
}
