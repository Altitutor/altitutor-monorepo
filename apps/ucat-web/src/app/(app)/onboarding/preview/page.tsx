import { notFound } from "next/navigation";
import { OnboardingPreviewLab } from "@/features/onboarding/components/onboarding-preview-lab";

export default function OnboardingPreviewRoute() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <OnboardingPreviewLab />;
}
