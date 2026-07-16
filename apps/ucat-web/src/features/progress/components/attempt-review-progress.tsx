"use client";

import { CheckCircle2, Eye, MoveRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import type { AttemptReviewState } from "@/features/progress/model/attempt-review";
import type { AttemptInsight } from "../lib/attempt-insights";
import { AttemptInsightCard } from "./attempt-insight-card";

export function AttemptReviewProgress({
  review,
  pending,
  error,
  onFinish,
  onReviewNext,
  insight,
}: {
  review: AttemptReviewState | null;
  pending: boolean;
  error: string | null;
  onFinish: () => Promise<void>;
  onReviewNext: (() => void) | null;
  insight: AttemptInsight;
}) {
  const viewed =
    review?.viewedQuestionIds.filter((id) =>
      review.requiredQuestionIds.includes(id),
    ).length ?? 0;
  const required = review?.requiredQuestionIds.length ?? 0;
  const complete = Boolean(review?.completedAt);

  return (
    <AttemptInsightCard label="Overall insight" insight={insight}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {complete ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </span>
          <div>
            <p className="font-medium">
              {complete ? "Review complete" : "Review this attempt"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {complete
                ? "You've viewed every incorrect question."
                : required === 0
                  ? "There are no answers that need attention."
                  : review
                    ? `${viewed} of ${required} incorrect, partial, or unanswered questions viewed.`
                    : "Preparing your review progress…"}
            </p>
            {error ? (
              <p className="mt-1 text-xs text-destructive">{error}</p>
            ) : null}
          </div>
        </div>
        {!complete && review ? (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {onReviewNext ? (
              <Button type="button" onClick={onReviewNext} disabled={pending}>
                Review next incorrect
                <MoveRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" disabled={pending}>
                  {pending ? "Saving…" : "Mark attempt as reviewed"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Mark this attempt as reviewed?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will complete the review even if you have not opened
                    every incorrect, partial, or unanswered question. You can
                    still return to this attempt later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void onFinish()}>
                    Mark as reviewed
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </div>
    </AttemptInsightCard>
  );
}
