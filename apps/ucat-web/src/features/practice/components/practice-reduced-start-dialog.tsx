"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";

type PracticeReducedStartDialogProps = {
  open: boolean;
  requestedCount: number;
  remainingCount: number;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PracticeReducedStartDialog({
  open,
  requestedCount,
  remainingCount,
  isPending,
  onCancel,
  onConfirm,
}: PracticeReducedStartDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Start a smaller practice set?</AlertDialogTitle>
          <AlertDialogDescription>
            You asked for {requestedCount} questions, but you have{" "}
            {remainingCount} new practice questions left in your UCAT Free
            allowance. Start with {remainingCount} questions using the same
            filters?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Loading…" : "Start smaller set"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
