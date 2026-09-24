import { Suspense } from "react";
import { TrialStudentsPage } from "@/features/onboarding/components/TrialStudentsPage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TrialStudentsPage />
    </Suspense>
  );
}
