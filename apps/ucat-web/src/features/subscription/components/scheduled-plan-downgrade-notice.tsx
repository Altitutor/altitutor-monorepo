import React, { type ReactNode } from "react";

import { formatInvoiceDate } from "@/features/subscription/lib/invoice-display";

type ScheduledPlanDowngradeNoticeProps = {
  endDate: string;
  error?: string | null;
  actions?: ReactNode;
};

export function ScheduledPlanDowngradeNotice({
  endDate,
  error,
  actions,
}: ScheduledPlanDowngradeNoticeProps) {
  return (
    <div
      role="alert"
      className="rounded-ucatShell flex flex-col gap-3 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:text-amber-100"
    >
      <div>
        <p>
          You&apos;re downgrading to UCAT Free on{" "}
          <span className="font-semibold">{formatInvoiceDate(endDate)}</span>.
          You&apos;ll keep paid access until then.
        </p>
        {error ? <p className="mt-1 text-destructive">{error}</p> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
