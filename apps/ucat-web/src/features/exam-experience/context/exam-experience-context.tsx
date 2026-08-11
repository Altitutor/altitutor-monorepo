"use client";

import {
  default as React,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { discardExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { useExamAttemptExitSync } from "@/features/exam-attempts/context/exam-attempt-exit-sync-context";
import { isQuestionEngineTutorialPath } from "@/features/onboarding/lib/question-engine-tutorial-gate";
import type { PracticeEngineLiveStats } from "@/features/question-engine/components/question-engine-page";
import { UCAT_DIALOG_PRIMARY_ACTION } from "@/lib/ucat-surface-motion";

type PracticeToolbarState = {
  stats: PracticeEngineLiveStats | null;
  elapsedSeconds: number;
  showAnswerStats: boolean;
  reviewAfterEachStem: boolean;
  onFinishPractice?: () => void;
};

type ExamExperienceContextValue = {
  title: string;
  practice: PracticeToolbarState | null;
  setTitle: (title: string | null) => void;
  setPractice: (practice: PracticeToolbarState | null) => void;
  requestExit: () => void;
};

const ExamExperienceContext = createContext<
  ExamExperienceContextValue | undefined
>(undefined);

type LeaveDialog = "options" | "discard" | null;

function fallbackExitHref(
  active: ReturnType<typeof useActiveExamAttempt>["active"],
): string {
  if (!active) return "/dashboard";
  if (active.kind === "practice") return "/practice";
  if (active.kind === "set") return `/sets/${active.resourceId}`;
  return `/mocks/${active.resourceId}`;
}

export function ExamExperienceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { active, clearLocal } = useActiveExamAttempt();
  const { flushBeforeExit } = useExamAttemptExitSync();
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [practice, setPractice] = useState<PracticeToolbarState | null>(null);
  const [leaveDialog, setLeaveDialog] = useState<LeaveDialog>(null);
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title =
    titleOverride ??
    active?.label ??
    (isQuestionEngineTutorialPath(pathname)
      ? "UCAT engine tutorial"
      : "UCAT exam");
  const exitHref = active?.exitHref ?? fallbackExitHref(active);

  const requestExit = useCallback(() => {
    setError(null);
    setLeaveDialog("options");
  }, []);

  const handleSaveExit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const saved = await flushBeforeExit().catch(() => false);
    if (!saved) {
      setError("We couldn't save your latest progress. Please try again.");
      setSaving(false);
      return;
    }
    setLeaveDialog(null);
    router.push(exitHref);
  };

  const handleDiscard = async () => {
    if (!active || discarding) return;
    setDiscarding(true);
    setError(null);
    try {
      await discardExamAttempt({
        kind: active.kind,
        attemptId: active.attemptId,
      });
      clearLocal();
      setLeaveDialog(null);
      router.push(exitHref);
    } catch {
      setError("We couldn't discard this attempt. Please try again.");
      setDiscarding(false);
    }
  };

  const value = useMemo<ExamExperienceContextValue>(
    () => ({
      title,
      practice,
      setTitle: setTitleOverride,
      setPractice,
      requestExit,
    }),
    [practice, requestExit, title],
  );

  return (
    <ExamExperienceContext.Provider value={value}>
      {children}
      <AlertDialog
        open={leaveDialog === "options"}
        onOpenChange={(open) => {
          if (!open && !saving) setLeaveDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isQuestionEngineTutorialPath(pathname)
                ? "Exit the tutorial?"
                : "Exit this session?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {error ??
                (active
                  ? "Save your progress to resume later, or permanently discard this attempt."
                  : "You can return to the app now.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setLeaveDialog(null)}
            >
              Cancel
            </Button>
            {active ? (
              <Button
                variant="destructive"
                disabled={saving}
                onClick={() => {
                  setError(null);
                  setLeaveDialog("discard");
                }}
              >
                Exit and discard
              </Button>
            ) : null}
            <Button
              className={UCAT_DIALOG_PRIMARY_ACTION}
              disabled={saving}
              onClick={() => void handleSaveExit()}
            >
              {saving
                ? "Saving…"
                : active
                  ? "Exit and save progress"
                  : "Exit tutorial"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={leaveDialog === "discard"}
        onOpenChange={(open) => {
          if (!open && !discarding) setLeaveDialog("options");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              {error ??
                "Your current attempt and saved progress will be discarded. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <Button
              variant="outline"
              disabled={discarding}
              onClick={() => setLeaveDialog("options")}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={discarding}
              onClick={() => void handleDiscard()}
            >
              {discarding ? "Discarding…" : "Discard attempt"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ExamExperienceContext.Provider>
  );
}

export function useExamExperience() {
  const context = useContext(ExamExperienceContext);
  if (!context) {
    throw new Error(
      "useExamExperience must be used within ExamExperienceProvider",
    );
  }
  return context;
}
