import { PreparationSandboxPage } from "@/features/preparation/components/preparation-sandbox-page";
import { requirePreparationSandboxAccess } from "@/features/preparation/server/require-preparation-sandbox-access";

export const dynamic = "force-dynamic";

export default async function PreparationSandboxRoute() {
  await requirePreparationSandboxAccess();
  return <PreparationSandboxPage />;
}
