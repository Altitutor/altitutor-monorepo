"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cancelUcatSubscriptionImmediately,
  resumeUcatSubscription,
} from "@/features/subscription/api/change-subscription-cancellation";
import { trackSubscriptionJourneyEvent } from "@/features/subscription/api/track-subscription-journey";
import { ImmediatePlanCancellationDialog } from "@/features/subscription/components/immediate-plan-cancellation-dialog";
import { ScheduledPlanDowngradeNotice } from "@/features/subscription/components/scheduled-plan-downgrade-notice";
import { useUcatSubscriptionBilling } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import { formatInvoiceDate } from "@/features/subscription/lib/invoice-display";

type ScheduledPlanDowngradeNoticeWithActionsProps = {
  endDate: string;
  planTier: string | null;
};

export function ScheduledPlanDowngradeNoticeWithActions({
  endDate,
  planTier,
}: ScheduledPlanDowngradeNoticeWithActionsProps) {
  const queryClient = useQueryClient();
  const { refetch } = useUcatSubscriptionBilling();
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [immediateCancelOpen, setImmediateCancelOpen] = useState(false);
  const [immediateCancelLoading, setImmediateCancelLoading] = useState(false);
  const [immediateCancelError, setImmediateCancelError] = useState<
    string | null
  >(null);

  const handleKeepPaidPlan = async () => {
    setResumeLoading(true);
    setResumeError(null);
    try {
      await resumeUcatSubscription();
      trackSubscriptionJourneyEvent({
        eventType: "cancellation_reversed",
        journeyContext: "subscription_settings",
        metadata: { current_plan: planTier },
      });
      await refetch();
    } catch (e) {
      setResumeError(
        e instanceof Error ? e.message : "Failed to keep your paid plan",
      );
    } finally {
      setResumeLoading(false);
    }
  };

  const handleCancelImmediately = async () => {
    setImmediateCancelLoading(true);
    setImmediateCancelError(null);
    try {
      await cancelUcatSubscriptionImmediately();
      trackSubscriptionJourneyEvent({
        eventType: "cancellation_accelerated",
        journeyContext: "subscription_settings",
        metadata: { previous_plan: planTier },
      });
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["ucat-access"] }),
      ]);
      setImmediateCancelOpen(false);
    } catch (e) {
      setImmediateCancelError(
        e instanceof Error ? e.message : "Failed to downgrade to UCAT Free now",
      );
    } finally {
      setImmediateCancelLoading(false);
    }
  };

  return (
    <>
      <ScheduledPlanDowngradeNotice
        endDate={endDate}
        error={resumeError}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              className="shrink-0 text-amber-950 hover:bg-amber-500/15 hover:text-amber-950 dark:text-amber-100 dark:hover:text-amber-100"
              disabled={resumeLoading}
              onClick={() => {
                setImmediateCancelError(null);
                setImmediateCancelOpen(true);
              }}
            >
              Downgrade now
            </Button>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={resumeLoading}
              onClick={() => void handleKeepPaidPlan()}
            >
              {resumeLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Keep paid plan
            </Button>
          </>
        }
      />
      <ImmediatePlanCancellationDialog
        open={immediateCancelOpen}
        onOpenChange={(open) => {
          if (!immediateCancelLoading) {
            setImmediateCancelOpen(open);
          }
        }}
        scheduledEndDate={formatInvoiceDate(endDate)}
        confirming={immediateCancelLoading}
        error={immediateCancelError}
        onConfirm={() => void handleCancelImmediately()}
      />
    </>
  );
}
