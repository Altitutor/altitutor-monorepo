"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Input,
  Label,
} from "@altitutor/ui";
import { useSections } from "@/features/progress/hooks/use-sections";
import {
  useCompleteOnboardingTour,
  useOnboardingProgress,
} from "@/features/onboarding/hooks/use-onboarding-progress";
import {
  useStudyPlannerSettings,
  useUpdateStudyPlannerSettings,
} from "@/features/study-planner/hooks/use-study-planner-settings";
import { UCAT_STUDY_PLANNER_ONBOARDING_TOUR_ID } from "@/features/study-planner/lib/onboarding";

type Step = 1 | 2 | 3 | 4;

function toInput(value: number | null): string {
  return value == null ? "" : String(value);
}

export function StudyPlannerOnboardingModal() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [testDate, setTestDate] = useState("");
  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [s3, setS3] = useState("");
  const [error, setError] = useState<string | null>(null);

  const progress = useOnboardingProgress();
  const completeTour = useCompleteOnboardingTour();
  const settings = useStudyPlannerSettings();
  const updateSettings = useUpdateStudyPlannerSettings();
  const sections = useSections();

  const isCompleted = progress.isCompleted(UCAT_STUDY_PLANNER_ONBOARDING_TOUR_ID);
  const open = !progress.isLoading && !isCompleted;

  const sectionNames = useMemo(() => {
    const byNumber = new Map<number, string>();
    for (const section of sections.data ?? []) {
      if (section.sectionNumber >= 1 && section.sectionNumber <= 3) {
        byNumber.set(section.sectionNumber, section.name);
      }
    }
    return {
      s1: byNumber.get(1) ?? "Section 1",
      s2: byNumber.get(2) ?? "Section 2",
      s3: byNumber.get(3) ?? "Section 3",
    };
  }, [sections.data]);

  const initializeFromSettings = () => {
    if (!settings.data) return;
    setTestDate(settings.data.testDate ?? "");
    setS1(toInput(settings.data.targetScores.s1));
    setS2(toInput(settings.data.targetScores.s2));
    setS3(toInput(settings.data.targetScores.s3));
  };

  const complete = async (navigateToMocks: boolean) => {
    try {
      await completeTour.mutateAsync(UCAT_STUDY_PLANNER_ONBOARDING_TOUR_ID);
      if (navigateToMocks) router.push("/mocks");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete onboarding");
    }
  };

  const saveAndContinue = async () => {
    setError(null);
    const parsed = [s1, s2, s3].map((value) =>
      value.trim() ? Number(value) : null,
    );
    if (parsed.some((value) => value !== null && !Number.isFinite(value))) {
      setError("Target scores must be numbers between 300 and 900.");
      return;
    }
    if (parsed.some((value) => value !== null && (value < 300 || value > 900))) {
      setError("Target scores must be numbers between 300 and 900.");
      return;
    }

    try {
      await updateSettings.mutateAsync({
        testDate: testDate || null,
        targetScores: {
          s1: parsed[0],
          s2: parsed[1],
          s3: parsed[2],
        },
      });
      setStep((prev) => (prev === 4 ? 4 : ((prev + 1) as Step)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    }
  };

  if (!open) return null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) void complete(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {step === 1 && "Welcome to your UCAT study planner"}
            {step === 2 && "Set your section targets"}
            {step === 3 && "How your projection updates"}
            {step === 4 && "Take a diagnostic mock"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {step === 1 &&
              "Set your test date and goals. We will project each section and adapt as you complete more attempts."}
            {step === 2 &&
              "Choose optional target scores for sections 1-3. Leave blank if you want to set them later."}
            {step === 3 &&
              "Every completed set updates your projection curve. Confidence improves as data grows."}
            {step === 4 &&
              "A diagnostic mock gives the model stronger early signal and improves your predictions faster."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {step === 1 ? (
          <div className="space-y-2">
            <Label htmlFor="onboarding-test-date">UCAT test date</Label>
            <Input
              id="onboarding-test-date"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              onFocus={initializeFromSettings}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="onboarding-target-s1">{sectionNames.s1}</Label>
              <Input
                id="onboarding-target-s1"
                type="number"
                min={300}
                max={900}
                value={s1}
                onChange={(e) => setS1(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-target-s2">{sectionNames.s2}</Label>
              <Input
                id="onboarding-target-s2"
                type="number"
                min={300}
                max={900}
                value={s2}
                onChange={(e) => setS2(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-target-s3">{sectionNames.s3}</Label>
              <Input
                id="onboarding-target-s3"
                type="number"
                min={300}
                max={900}
                value={s3}
                onChange={(e) => setS3(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
            You will see conservative, realistic, and aggressive projection bands.
            Low-data phases are clearly marked until your personal trend stabilizes.
          </div>
        ) : null}

        {step === 4 ? (
          <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
            Recommended next step: complete a full mock now to personalize your
            starting model.
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <AlertDialogFooter>
          {step < 4 ? (
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (step === 1) {
                  setStep(2);
                  return;
                }
                if (step === 2) {
                  void saveAndContinue();
                  return;
                }
                setStep(4);
              }}
              disabled={updateSettings.isPending}
            >
              Continue
            </AlertDialogAction>
          ) : (
            <>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void complete(false);
                }}
              >
                Skip for now
              </AlertDialogAction>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void complete(true);
                }}
              >
                Start diagnostic mock
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
