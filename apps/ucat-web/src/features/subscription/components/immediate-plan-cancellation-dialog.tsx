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
import { Loader2 } from "lucide-react";

type ImmediatePlanCancellationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduledEndDate: string;
  confirming: boolean;
  error: string | null;
  onConfirm: () => void;
};

export function ImmediatePlanCancellationDialog({
  open,
  onOpenChange,
  scheduledEndDate,
  confirming,
  error,
  onConfirm,
}: ImmediatePlanCancellationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Downgrade to UCAT Free now?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              <p>
                Your paid access will end immediately instead of on{" "}
                <span className="font-medium text-foreground">
                  {scheduledEndDate}
                </span>
                . You won&apos;t receive an automatic refund for the unused
                time.
              </p>
              <p>
                Your account, practice history and results will remain safe on
                UCAT Free.
              </p>
              {error ? <p className="text-destructive">{error}</p> : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>
            Keep access until {scheduledEndDate}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downgrading…
              </>
            ) : (
              "Downgrade to Free now"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
