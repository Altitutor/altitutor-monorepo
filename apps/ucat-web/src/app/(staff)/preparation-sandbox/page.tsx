import { redirect } from "next/navigation";
import { requireDevelopmentPreview } from "@/features/development-preview/lib/development-preview";

export const dynamic = "force-dynamic";

export default function PreparationSandboxRoute() {
  requireDevelopmentPreview();
  redirect("/study-plan/preview");
}
