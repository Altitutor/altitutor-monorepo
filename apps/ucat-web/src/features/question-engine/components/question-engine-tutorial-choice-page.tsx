"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildQuestionEngineTutorialHref } from "@/features/onboarding/lib/question-engine-tutorial-gate";
import { UCAT_SURFACE_CARD } from "@/lib/ucat-surface-motion";

export function QuestionEngineTutorialChoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/dashboard";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-3xl items-center px-4 py-10">
      <section className={`${UCAT_SURFACE_CARD} w-full rounded-ucatShell p-6 sm:p-8`}>
        <p className="text-sm font-semibold text-primary">
          Before your first attempt
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          How much guidance would you like?
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Choose the full UCAT interface walkthrough if the exam controls are
          new to you. If you already know the UCAT interface, review only the
          controls that are specific to Altitutor.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border bg-background/60 p-5">
            <BookOpen className="h-6 w-6 text-primary" aria-hidden />
            <h2 className="mt-4 font-semibold">Full interface tutorial</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              Covers the UCAT question controls, calculator, flagging,
              navigator, shortcuts, review, and Altitutor controls.
            </p>
            <Button
              type="button"
              className="mt-5"
              onClick={() =>
                router.replace(
                  buildQuestionEngineTutorialHref(returnTo, "full"),
                )
              }
            >
              Show full tutorial
            </Button>
          </div>

          <div className="flex flex-col rounded-2xl border bg-background/60 p-5">
            <Settings className="h-6 w-6 text-primary" aria-hidden />
            <h2 className="mt-4 font-semibold">Altitutor controls only</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              A short introduction to the Altitutor menu, toolbar, Lag mode,
              reporting, finishing, and leaving an attempt.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={() =>
                router.replace(
                  buildQuestionEngineTutorialHref(returnTo, "controls"),
                )
              }
            >
              Show Altitutor controls
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
