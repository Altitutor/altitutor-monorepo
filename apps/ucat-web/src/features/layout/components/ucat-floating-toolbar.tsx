"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, Home, LifeBuoy, Menu, Settings } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  FeedbackDialog,
  type FeedbackKind,
} from "@altitutor/ui";
import { useUcatLag } from "@/features/question-engine/context/ucat-lag-context";
import { UCAT_DIALOG_PRIMARY_ACTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function UcatFloatingToolbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind | null>(null);
  const { enabled: lagEnabled, setEnabled: setLagEnabled } = useUcatLag();

  const handleGoHomeClick = () => {
    setMenuOpen(false);
    setLeaveConfirmOpen(true);
  };

  const handleConfirmLeave = () => {
    setLeaveConfirmOpen(false);
    router.push("/");
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
          leaveConfirmOpen && "invisible",
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
                "absolute left-1/2 top-9 z-[61] w-48 -translate-x-1/2 overflow-hidden rounded-lg border-0 bg-card p-1 text-sm text-card-foreground shadow-lg",
                menuOpen ? "block" : "hidden",
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
                "absolute right-0 top-9 z-[61] mt-1 w-64 overflow-hidden rounded-lg border-0 bg-card p-1 text-sm text-card-foreground shadow-lg",
                settingsOpen ? "block" : "hidden",
              )}
            >
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                UCAT settings
              </div>
              <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 ease-out hover:bg-muted">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Lag mode</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Simulate exam delay
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-current"
                  checked={lagEnabled}
                  onChange={(event) => setLagEnabled(event.target.checked)}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this UCAT exam?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress is saved, and you can resume later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              className={UCAT_DIALOG_PRIMARY_ACTION}
              onClick={handleConfirmLeave}
            >
              Go home
            </AlertDialogAction>
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
