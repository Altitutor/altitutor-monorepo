import { Suspense } from "react";
import { GuidedSamplerPage } from "@/features/signup-onboarding/components/guided-sampler-page";

export default function GuidedSamplerRoute() {
  return (
    <Suspense fallback={null}>
      <GuidedSamplerPage />
    </Suspense>
  );
}
