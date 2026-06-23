"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { UCAT_PRIMARY_ACTION_BUTTON } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type LearningMarkLessonCompleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incompleteBlockLabels: Array<{ id: string; label: string }>;
  confirming: boolean;
  onConfirm: () => void;
};

export function LearningMarkLessonCompleteDialog({
  open,
  onOpenChange,
  incompleteBlockLabels,
  confirming,
  onConfirm,
}: LearningMarkLessonCompleteDialogProps) {
  const allComplete = incompleteBlockLabels.length === 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Mark lesson complete?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              {allComplete ? (
                <p>All blocks are complete. Mark this lesson as finished?</p>
              ) : (
                <>
                  <p>
                    The following blocks are not complete yet. Marking the lesson
                    complete will mark all blocks as done.
                  </p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-foreground">
                    {incompleteBlockLabels.map((entry) => (
                      <li key={entry.id} className="text-sm">
                        {entry.label}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className={cn(UCAT_PRIMARY_ACTION_BUTTON, "min-w-[7rem]")}
          >
            {confirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Mark complete"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type LearningMarkLessonIncompleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirming: boolean;
  onConfirm: () => void;
};

export function LearningMarkLessonIncompleteDialog({
  open,
  onOpenChange,
  confirming,
  onConfirm,
}: LearningMarkLessonIncompleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Reset lesson progress?</AlertDialogTitle>
          <AlertDialogDescription>
            This clears all block progress for this lesson and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting…
              </>
            ) : (
              "Mark incomplete"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
