"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Skeleton,
} from "@altitutor/ui";
import type { UcatUpgradePreview } from "@/features/subscription/api/fetch-upgrade-preview";
import { formatMoneyFromMinorUnits } from "@/features/subscription/lib/format-subscription-copy";
import { UCAT_PRIMARY_ACTION_BUTTON } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type PlanUpgradeConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: UcatUpgradePreview | null;
  previewLoading: boolean;
  previewError: string | null;
  confirming: boolean;
  omitAudPrefix?: boolean;
  onConfirm: () => void;
};

export function PlanUpgradeConfirmDialog({
  open,
  onOpenChange,
  preview,
  previewLoading,
  previewError,
  confirming,
  omitAudPrefix,
  onConfirm,
}: PlanUpgradeConfirmDialogProps) {
  const formatMoney = (cents: number) =>
    formatMoneyFromMinorUnits(cents, preview?.currency ?? "aud", {
      omitAudPrefix,
    });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Upgrade to UCAT Pro</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left text-sm text-muted-foreground">
              <p>
                You&apos;re upgrading from UCAT Unlimited to UCAT Pro on your
                current billing interval. Your interval stays the same.
              </p>

              {previewLoading ? (
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-4">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ) : previewError ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                  {previewError}
                </p>
              ) : preview ? (
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4 text-foreground">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Due today
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      {preview.isTrialing
                        ? formatMoney(0)
                        : formatMoney(preview.dueTodayCents)}
                    </p>
                    {preview.isTrialing ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        You&apos;re still in your free trial — you won&apos;t be
                        charged until the trial ends.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Prorated charge for the rest of this billing period.
                      </p>
                    )}
                  </div>
                  <div className="border-t border-border/60 pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Next renewal
                    </p>
                    <p className="mt-1 font-medium">
                      {formatMoney(preview.renewalStandardCents)} /{" "}
                      {preview.billingIntervalNoun}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Standard Pro price before practice-day discounts.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            className={cn(UCAT_PRIMARY_ACTION_BUTTON)}
            disabled={previewLoading || confirming || !preview || !!previewError}
            onClick={onConfirm}
          >
            {confirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Upgrading…
              </>
            ) : (
              "Confirm upgrade"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
