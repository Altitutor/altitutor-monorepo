"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { useProgressSummary } from "@/features/progress/hooks/use-progress";
import { hasCompletedQuestion } from "@/features/progress/lib/progress-access";
import { UCAT_DIALOG_PRIMARY_ACTION } from "@/lib/ucat-surface-motion";

export function ProgressAccessGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const progress = useProgressSummary();

  if (progress.isLoading) {
    return <AppPageSkeleton />;
  }

  // Fail open if progress cannot be checked; the destination page owns its
  // normal error state and the student is not trapped behind an unrelated error.
  if (progress.error || !progress.data) {
    return <>{children}</>;
  }

  if (hasCompletedQuestion(progress.data.sectionProgress)) {
    return <>{children}</>;
  }

  return (
    <>
      <AppPageSkeleton />
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete a question first</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress pages will become available after you complete at
              least one practice question.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.replace("/dashboard")}
            >
              Back to dashboard
            </Button>
            <AlertDialogAction
              className={UCAT_DIALOG_PRIMARY_ACTION}
              onClick={() => router.replace("/practice")}
            >
              Go to practice questions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
