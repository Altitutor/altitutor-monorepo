import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardPreviewPage } from "@/features/dashboard/components/dashboard-preview-page";
import { AttemptPreviewPage } from "@/features/progress/components/attempt-preview-page";
import { ProgressPreviewPage } from "@/features/progress/components/progress-preview-page";
import { StudyPlanPreviewPage } from "@/features/study-plan/components/study-plan-preview-page";
import { StudyPlanExtraStudyProvider } from "@/features/study-plan/components/study-plan-extra-study";
import { LearningLessonPreviewPage } from "@/features/learning/components/learning-lesson-preview-page";
import { MarketingPreviewLightMode } from "../marketing-preview-light-mode";

const SURFACES = [
  "dashboard",
  "progress",
  "study-plan",
  "review",
  "learning",
] as const;

type MarketingPreviewSurface = (typeof SURFACES)[number];

export const metadata: Metadata = {
  title: "Altitutor UCAT product preview",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return SURFACES.map((surface) => ({ surface }));
}

export default function MarketingPreviewPage({
  params,
}: {
  params: { surface: string };
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  if (!SURFACES.includes(params.surface as MarketingPreviewSurface)) {
    notFound();
  }

  return (
    <StudyPlanExtraStudyProvider>
      <MarketingPreviewLightMode />
      <main className="min-h-screen bg-[#f6f7f9] py-5">
        {params.surface === "dashboard" ? (
          <DashboardPreviewPage embedded initialScenario="within_reach" />
        ) : null}
        {params.surface === "progress" ? (
          <ProgressPreviewPage embedded initialScenario="needs_focus" />
        ) : null}
        {params.surface === "study-plan" ? (
          <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-6">
            <StudyPlanPreviewPage embedded initialScenario="typical_week" />
          </div>
        ) : null}
        {params.surface === "review" ? (
          <AttemptPreviewPage embedded initialAttempt="set" marketingCapture />
        ) : null}
        {params.surface === "learning" ? (
          <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-6">
            <LearningLessonPreviewPage />
          </div>
        ) : null}
      </main>
    </StudyPlanExtraStudyProvider>
  );
}
