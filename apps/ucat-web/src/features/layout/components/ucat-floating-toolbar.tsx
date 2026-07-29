"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, Home, LifeBuoy, Menu, Settings } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  FeedbackDialog,
  Switch,
  type FeedbackKind,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { discardExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { useUcatLag } from "@/features/question-engine/context/ucat-lag-context";
import { useExamAttemptExitSync } from "@/features/exam-attempts/context/exam-attempt-exit-sync-context";
import { UCAT_DIALOG_PRIMARY_ACTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type LeaveDialog = "exit-options" | "discard-confirmation" | null;

export function UcatFloatingToolbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState<LeaveDialog>(null);
  const [isSavingBeforeLeave, setIsSavingBeforeLeave] = useState(false);
  const [isDiscardingAttempt, setIsDiscardingAttempt] = useState(false);
  const [leaveSaveFailed, setLeaveSaveFailed] = useState(false);
  const [discardFailed, setDiscardFailed] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind | null>(null);
  const { enabled: lagEnabled, setEnabled: setLagEnabled } = useUcatLag();
  const { flushBeforeExit } = useExamAttemptExitSync();
  const { active, clearLocal } = useActiveExamAttempt();

  const handleGoHomeClick = () => {
    setMenuOpen(false);
    setLeaveSaveFailed(false);
    setDiscardFailed(false);
    setLeaveDialog("exit-options");
  };

  const handleExitAndSave = async () => {
    if (isSavingBeforeLeave) return;
    setIsSavingBeforeLeave(true);
    setLeaveSaveFailed(false);
    const saved = await flushBeforeExit().catch(() => false);
    if (!saved) {
      setLeaveSaveFailed(true);
      setIsSavingBeforeLeave(false);
      return;
    }
    setLeaveDialog(null);
    router.push("/");
  };

  const handleDiscardAttempt = async () => {
    if (!active || isDiscardingAttempt) return;
    setIsDiscardingAttempt(true);
    setDiscardFailed(false);
    try {
      await discardExamAttempt({
        kind: active.kind,
        attemptId: active.attemptId,
      });
      clearLocal();
      setLeaveDialog(null);
      router.push("/");
    } catch {
      setDiscardFailed(true);
      setIsDiscardingAttempt(false);
    }
  };

  const handleMenuClick = () => {
    setMenuOpen((prev) => {
      const next = !prev;
      if (next) setSettingsOpen(false);
      return next;
    });
  };

  const handleSettingsClick = () => {
    setSettingsOpen((prev) => {
      const next = !prev;
      if (next) setMenuOpen(false);
      return next;
    });
  };

  const handleFeedbackClick = (kind: FeedbackKind) => {
    setMenuOpen(false);
    setSettingsOpen(false);
    setFeedbackKind(kind);
  };

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 top-2 z-[60] flex justify-center",
          leaveDialog && "invisible",
        )}
      >
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1 text-sm shadow-md transition-shadow duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-lg">
          <div className="relative flex items-center gap-1">
            <button
              type="button"
              data-tour="question-engine-menu"
              title="Open menu"
              aria-label="Open menu"
              onClick={handleMenuClick}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-transparent text-foreground transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted/50 active:scale-95"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-tour="question-engine-settings"
              title="Open settings"
              aria-label="Open settings"
              onClick={handleSettingsClick}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-transparent text-foreground transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted/50 active:scale-95"
            >
              <Settings className="h-4 w-4" />
            </button>

            <div
              className={cn(
                "absolute left-1/2 top-9 z-[61] w-[min(12rem,calc(100vw-1rem))] -translate-x-1/2 overflow-hidden rounded-lg border-0 bg-card p-1 text-sm text-card-foreground shadow-lg transition-[opacity,transform,visibility] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                menuOpen
                  ? "visible translate-y-0 scale-100 opacity-100"
                  : "invisible pointer-events-none -translate-y-1 scale-95 opacity-0",
              )}
            >
              <button
                type="button"
                className="flex h-8 w-full items-center rounded-md px-2 text-left transition-colors duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={handleGoHomeClick}
              >
                <Home className="mr-2 h-4 w-4" />
                Go home
              </button>
              <div className="-mx-1 my-1 h-px bg-border/70" />
              <button
                type="button"
                className="flex h-8 w-full items-center rounded-md px-2 text-left transition-colors duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => handleFeedbackClick("contact")}
              >
                <LifeBuoy className="mr-2 h-4 w-4" />
                Contact us
              </button>
              <button
                type="button"
                className="flex h-8 w-full items-center rounded-md px-2 text-left transition-colors duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => handleFeedbackClick("bug")}
              >
                <Bug className="mr-2 h-4 w-4" />
                Report a bug
              </button>
            </div>

            <div
              className={cn(
                "absolute left-1/2 top-9 z-[61] mt-1 w-[min(16rem,calc(100vw-1rem))] -translate-x-1/2 overflow-hidden rounded-lg border-0 bg-card p-1 text-sm text-card-foreground shadow-lg transition-[opacity,transform,visibility] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                settingsOpen
                  ? "visible translate-y-0 scale-100 opacity-100"
                  : "invisible pointer-events-none -translate-y-1 scale-95 opacity-0",
              )}
            >
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                UCAT settings
              </div>
              <div className="flex min-h-9 items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 ease-out hover:bg-muted">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Lag mode</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Simulate exam delay
                  </span>
                </span>
                <Switch
                  aria-label="Lag mode"
                  checked={lagEnabled}
                  onCheckedChange={setLagEnabled}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <AlertDialog
        open={leaveDialog === "exit-options"}
        onOpenChange={(open) => {
          if (!open && isSavingBeforeLeave) return;
          if (!open) setLeaveDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit this attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              {leaveSaveFailed
                ? "We couldn't save your latest progress. Please try again before leaving."
                : "You can save your progress and resume later, or permanently discard this attempt."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <Button
              variant="outline"
              disabled={isSavingBeforeLeave}
              onClick={() => setLeaveDialog(null)}
            >
              Cancel
            </Button>
            {active ? (
              <Button
                variant="destructive"
                disabled={isSavingBeforeLeave}
                onClick={() => {
                  setDiscardFailed(false);
                  setLeaveDialog("discard-confirmation");
                }}
              >
                Exit and discard attempt
              </Button>
            ) : null}
            <Button
              className={UCAT_DIALOG_PRIMARY_ACTION}
              disabled={isSavingBeforeLeave}
              onClick={() => void handleExitAndSave()}
            >
              {isSavingBeforeLeave ? "Saving…" : "Exit and save progress"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={leaveDialog === "discard-confirmation"}
        onOpenChange={(open) => {
          if (!open && isDiscardingAttempt) return;
          if (!open) {
            setDiscardFailed(false);
            setLeaveDialog("exit-options");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              {discardFailed
                ? "We couldn't discard this attempt. Please try again."
                : "Your current attempt and saved progress will be discarded. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <Button
              variant="outline"
              disabled={isDiscardingAttempt}
              onClick={() => {
                setDiscardFailed(false);
                setLeaveDialog("exit-options");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDiscardingAttempt}
              onClick={() => void handleDiscardAttempt()}
            >
              {isDiscardingAttempt ? "Discarding…" : "Discard attempt"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {feedbackKind ? (
        <FeedbackDialog
          open
          onOpenChange={(open) => !open && setFeedbackKind(null)}
          kind={feedbackKind}
          appName="ucat-web"
        />
      ) : null}
    </>
  );
}
