"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  useToast,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { UCAT_DIALOG_PRIMARY_ACTION } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type QuotaResetEntitlementPanelProps = {
  availableCount: number;
  nextExpiresAt: string | null;
  className?: string;
};

export function QuotaResetEntitlementPanel({
  availableCount,
  nextExpiresAt,
  className,
}: QuotaResetEntitlementPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isUsingReset, setIsUsingReset] = useState(false);

  if (availableCount <= 0) return null;

  const nextResetExpiry = nextExpiresAt
    ? new Intl.DateTimeFormat("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(nextExpiresAt))
    : null;

  const handleUseReset = async () => {
    setIsUsingReset(true);
    try {
      const response = await fetch("/api/ucat/quota-reset-entitlements/use", {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to use quota reset");
      }

      await queryClient.invalidateQueries({ queryKey: ["ucat-quota-usage"] });
      toast({ title: "Quota reset applied" });
      setConfirmOpen(false);
    } catch (error) {
      toast({
        title: "Could not use quota reset",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUsingReset(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm",
          className,
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {availableCount} quota reset{availableCount === 1 ? "" : "s"}{" "}
              available
            </p>
            {nextResetExpiry ? (
              <p className="text-xs text-muted-foreground">
                Next expires {nextResetExpiry}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setConfirmOpen(true)}
          >
            Use reset
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use quota reset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all of your UCAT Free quota usage to zero for the
              current period. Your attempt history will stay unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUsingReset}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={UCAT_DIALOG_PRIMARY_ACTION}
              onClick={(event) => {
                event.preventDefault();
                void handleUseReset();
              }}
              disabled={isUsingReset}
            >
              {isUsingReset ? "Using reset..." : "Use reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
