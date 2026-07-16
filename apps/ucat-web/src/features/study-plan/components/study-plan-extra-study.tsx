"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import { Check, Clock3, Loader2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createExtraStudy } from "@/features/study-plan/api/study-plan";
import type {
  StudyPlanExtraStudyMinutes,
  StudyPlanResponse,
  StudyPlanSection,
} from "@/features/study-plan/model/types";
import { UCAT_CLICKABLE_CARD_SELECTED } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const TIME_OPTIONS: StudyPlanExtraStudyMinutes[] = [10, 20, 30, 45];
const SECTION_OPTIONS: Array<{ key: StudyPlanSection["key"]; label: string }> =
  [
    { key: "verbal_reasoning", label: "VR" },
    { key: "decision_making", label: "DM" },
    { key: "quantitative_reasoning", label: "QR" },
    { key: "situational_judgement", label: "SJT" },
  ];

const ExtraStudyDialogContext = createContext<(() => void) | null>(null);

export function useStudyPlanExtraStudyDialog() {
  const open = useContext(ExtraStudyDialogContext);
  if (!open)
    throw new Error("Extra study dialog must be used inside its provider.");
  return open;
}

export function StudyPlanExtraStudyProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState<StudyPlanExtraStudyMinutes>(20);
  const [showSections, setShowSections] = useState(false);
  const [sectionKey, setSectionKey] = useState<StudyPlanSection["key"] | null>(
    null,
  );
  const mutation = useMutation({
    mutationFn: createExtraStudy,
    onSuccess: (nextPlan) => {
      queryClient.setQueryData(["ucat-study-plan"], nextPlan);
      setOpen(false);
      setSectionKey(null);
      setShowSections(false);
    },
  });
  const selectedSection = SECTION_OPTIONS.find(
    (section) => section.key === sectionKey,
  );
  const resetMutation = mutation.reset;
  const openDialog = useCallback(() => {
    resetMutation();
    setOpen(true);
  }, [resetMutation]);

  return (
    <ExtraStudyDialogContext.Provider value={openDialog}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle>How much time do you have?</DialogTitle>
            <DialogDescription>
              We’ll add a focused block for extra practice today.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-1">
            <div>
              <p className="mb-2 text-sm font-medium">Available time</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TIME_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant="outline"
                    aria-pressed={minutes === option}
                    onClick={() => setMinutes(option)}
                    className={cn(
                      "gap-1.5",
                      minutes === option && [
                        UCAT_CLICKABLE_CARD_SELECTED,
                        "!border-transparent ring-1",
                      ],
                    )}
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                    {option} min
                  </Button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/25 p-3.5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {selectedSection
                      ? `${selectedSection.label} selected`
                      : "Choose the best activity for me"}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {selectedSection
                      ? "We’ll choose the highest-value category within this section."
                      : "We’ll use your current score gaps and category performance."}
                  </p>
                </div>
              </div>
            </div>
            {showSections ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Section preference</p>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => {
                      setSectionKey(null);
                      setShowSections(false);
                    }}
                  >
                    Let my plan choose
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {SECTION_OPTIONS.map((section) => (
                    <button
                      key={section.key}
                      type="button"
                      aria-pressed={sectionKey === section.key}
                      onClick={() => setSectionKey(section.key)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        sectionKey === section.key
                          ? [
                              UCAT_CLICKABLE_CARD_SELECTED,
                              "border-transparent ring-1",
                            ]
                          : "bg-background hover:bg-muted",
                      )}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => setShowSections(true)}
              >
                Choose a section instead
              </button>
            )}
            {mutation.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "We couldn’t add an activity."}
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ minutes, sectionKey })}
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {mutation.isPending
                ? "Building your extra block…"
                : "Add to today"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ExtraStudyDialogContext.Provider>
  );
}

export function StudyPlanExtraStudy({
  plan,
  compact = false,
  interactive = true,
}: {
  plan: StudyPlanResponse;
  compact?: boolean;
  interactive?: boolean;
}) {
  const open = useStudyPlanExtraStudyDialog();
  const todayIsClear = plan.todayTasks.length === 0;
  const todayIsComplete =
    plan.todayTasks.length > 0 &&
    plan.todayTasks.every((task) => task.status === "completed");
  const hasEarlierTasks = plan.tasks.some(
    (task) =>
      task.scheduledDate < plan.today &&
      task.status !== "completed" &&
      task.status !== "skipped",
  );
  if (hasEarlierTasks || (!todayIsClear && !todayIsComplete)) return null;

  if (compact) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={interactive ? open : undefined}
        disabled={!interactive}
      >
        <Plus className="mr-2 h-4 w-4" />
        {todayIsComplete ? "I have time for more" : "Study today"}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {todayIsComplete ? (
            <Check className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </span>
        <div>
          <p className="font-medium">
            {todayIsComplete
              ? "You’re done for today"
              : "Nothing is planned for today"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tell us how long you have and your plan will choose one useful extra
            block.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="shrink-0 bg-background"
        onClick={interactive ? open : undefined}
        disabled={!interactive}
      >
        <Plus className="mr-2 h-4 w-4" />
        {todayIsComplete ? "I have time for more" : "I’d like to study today"}
      </Button>
    </div>
  );
}
