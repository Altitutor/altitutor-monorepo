import { OnboardingPreviewLab } from "@/features/onboarding/components/onboarding-preview-lab";
import { requireDevelopmentPreview } from "@/features/development-preview/lib/development-preview";

export default function OnboardingPreviewRoute() {
  requireDevelopmentPreview();
  return <OnboardingPreviewLab />;
}
