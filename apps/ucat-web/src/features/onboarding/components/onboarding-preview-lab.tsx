"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Card,
  CardContent,
  useToast,
} from "@altitutor/ui";
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  GraduationCap,
  RotateCcw,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UCAT_QUESTION_ENGINE_TOUR } from "@/features/onboarding/config/tour-steps";
import {
  useOnboardingProgress,
  useResetAllOnboardingTours,
  useResetOnboardingTour,
} from "@/features/onboarding/hooks/use-onboarding-progress";
import {
  UCAT_GUIDED_SAMPLER_COMPLETED,
  UCAT_GUIDED_SAMPLER_DECIDED,
} from "@/features/onboarding/lib/activation-milestones";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";

const SAMPLE_QUESTION_MILESTONES = [
  UCAT_GUIDED_SAMPLER_DECIDED,
  UCAT_GUIDED_SAMPLER_COMPLETED,
  UCAT_QUESTION_ENGINE_TOUR,
] as const;

const PREVIEWS = [
  {
    title: "Completely new",
    description: "UCAT essentials slideshow, then the full guided walkthrough.",
    href: "/signup/complete/sampler?familiarity=new&replay=1",
    Icon: GraduationCap,
  },
  {
    title: "Familiar",
    description: "Sample questions with the guided controls walkthrough.",
    href: "/signup/complete/sampler?familiarity=familiar&replay=1",
    Icon: BookOpenCheck,
  },
  {
    title: "Experienced",
    description: "Sample questions with help only after difficulty or delay.",
    href: "/signup/complete/sampler?familiarity=experienced&replay=1",
    Icon: BrainCircuit,
  },
] as const;

type ResetScope = "sample-questions" | "all" | null;

export function OnboardingPreviewLab() {
  const { toast } = useToast();
  const onboarding = useOnboardingProgress();
  const resetTour = useResetOnboardingTour();
  const resetAll = useResetAllOnboardingTours();
  const [resetScope, setResetScope] = useState<ResetScope>(null);
  const isResetting = resetTour.isPending || resetAll.isPending;

  async function confirmReset() {
    if (!resetScope) return;
    try {
      if (resetScope === "all") {
        await resetAll.mutateAsync();
      } else {
        for (const milestone of SAMPLE_QUESTION_MILESTONES) {
          await resetTour.mutateAsync(milestone);
        }
      }
      toast({
        title: "Onboarding state reset",
        description:
          resetScope === "all"
            ? "All walkthroughs will be available again for this account."
            : "The sample-question walkthrough and dashboard milestone are ready to test again.",
      });
      setResetScope(null);
    } catch (error) {
      toast({
        title: "Could not reset onboarding",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  const sampleQuestionsComplete = onboarding.isCompleted(
    UCAT_GUIDED_SAMPLER_COMPLETED,
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Development only</Badge>
            <Badge variant="outline">
              Sample questions: {sampleQuestionsComplete ? "complete" : "open"}
            </Badge>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Onboarding preview lab
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Reopen individual onboarding scenes with your current test account.
            You do not need a new email or a manual database update.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setResetScope("sample-questions")}
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
          Reset sample questions
        </Button>
      </div>

      <section aria-labelledby="sample-question-previews">
        <h2 id="sample-question-previews" className="text-lg font-semibold">
          Sample-question paths
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {PREVIEWS.map(({ title, description, href, Icon }) => (
            <Card key={title} className={UCAT_CARD_CHROME}>
              <CardContent className="flex h-full flex-col p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
                <Button asChild className="mt-5 w-full">
                  <Link href={href}>
                    Open preview
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="other-onboarding-previews">
        <h2 id="other-onboarding-previews" className="text-lg font-semibold">
          Other setup screens
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "UCAT year and target score",
              href: "/ucat-goal/setup",
              Icon: Target,
            },
            {
              title: "Study plan setup",
              href: "/study-plan/setup?section=plan",
              Icon: CalendarDays,
            },
          ].map(({ title, href, Icon }) => (
            <Link
              key={title}
              href={href}
              className="group flex items-center gap-4 rounded-2xl bg-card p-5 shadow-sm transition-colors hover:bg-muted/60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="font-medium">{title}</span>
              <ArrowRight
                className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </section>

      <Card className={UCAT_CARD_CHROME}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Reset every walkthrough</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Clears onboarding progress only for the currently signed-in test
              account. It does not delete practice results, profile details or
              subscription data.
            </p>
          </div>
          <Button variant="destructive" onClick={() => setResetScope("all")}>
            Reset all walkthroughs
          </Button>
        </CardContent>
      </Card>

      <AlertDialog
        open={resetScope !== null}
        onOpenChange={(open) => !open && !isResetting && setResetScope(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resetScope === "all"
                ? "Reset every walkthrough?"
                : "Reset sample-question onboarding?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This updates onboarding progress for the current signed-in account
              so you can test the experience again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetScope(null)}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant={resetScope === "all" ? "destructive" : "default"}
              onClick={() => void confirmReset()}
              disabled={isResetting}
            >
              {isResetting ? "Resetting…" : "Reset onboarding"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
