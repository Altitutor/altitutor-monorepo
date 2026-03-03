'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui';
import { CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import { addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import type { ReportDataPoint, RevenueReportDataPoint } from '../types';
import { useBillingStatsReport } from '../hooks/useAdditionalReports';
import { RevenueReportChart } from './RevenueReportChart';
import { IssuesReportChart } from './IssuesReportChart';

type BillingDialogKind = 'predicted' | 'actual' | 'refunds' | 'credits' | 'voided' | null;

export function BillingStatsSection() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogKind, setDialogKind] = useState<BillingDialogKind>(null);
  const [selectedRevenuePoint, setSelectedRevenuePoint] =
    useState<RevenueReportDataPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ReportDataPoint | null>(null);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });
  const weekEnd = endOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });

  const { data, isLoading, error } = useBillingStatsReport(weekStart, weekEnd);

  const weekLabel = `${format(weekStart, 'd MMM')} – ${format(
    weekEnd,
    'd MMM yyyy'
  )}`;

  const openRevenueDialog =
    (kind: Exclude<BillingDialogKind, null>) =>
    (point: RevenueReportDataPoint) => {
      setDialogKind(kind);
      setSelectedRevenuePoint(point);
      setSelectedPoint(null);
    };

  const openCountDialog =
    (kind: Exclude<BillingDialogKind, null>) =>
    (point: ReportDataPoint) => {
      setDialogKind(kind);
      setSelectedPoint(point);
      setSelectedRevenuePoint(null);
    };

  const closeDialog = () => {
    setDialogKind(null);
    setSelectedPoint(null);
    setSelectedRevenuePoint(null);
  };

  const renderDialogTitle = () => {
    const date =
      selectedRevenuePoint?.date ??
      selectedPoint?.date ??
      '';
    const base =
      selectedRevenuePoint?.amountCents != null
        ? `${date} (${(selectedRevenuePoint.amountCents / 100).toFixed(2)} AUD)`
        : selectedPoint
        ? `${date} (${selectedPoint.count})`
        : '';

    switch (dialogKind) {
      case 'predicted':
        return `Predicted revenue on ${base}`;
      case 'actual':
        return `Actual revenue on ${base}`;
      case 'refunds':
        return `Refunds on ${base}`;
      case 'credits':
        return `Credits issued on ${base}`;
      case 'voided':
        return `Voided invoices on ${base}`;
      default:
        return 'Billing stats';
    }
  };

  const entities =
    selectedRevenuePoint?.entities ?? selectedPoint?.entities ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing stats
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekOffset((o) => o - 1)}
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekOffset((o) => o + 1)}
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {error && (
            <p className="text-sm text-destructive">
              Failed to load billing stats. Please try again.
            </p>
          )}

          <p className="text-xs text-muted-foreground">Week: {weekLabel}</p>

          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium mb-2">Predicted revenue</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Derived from non-fee invoice items created in the period.
              </p>
              {isLoading ? (
                <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <RevenueReportChart
                  data={data?.predictedRevenueByDay ?? []}
                  title="Predicted revenue"
                  barColor="#0f766e"
                />
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Actual revenue</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Sum of invoice amounts minus fees for invoices dated that day.
              </p>
              {isLoading ? (
                <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <RevenueReportChart
                  data={data?.actualRevenueByDay ?? []}
                  title="Actual revenue"
                  barColor="#2563eb"
                />
              )}
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="text-sm font-medium mb-2">Refunds</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Number of refunds over time, grouped by refund date.
              </p>
              {isLoading ? (
                <div className="h-[200px] flex items-center justify-center bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <IssuesReportChart
                  data={data?.refundsByDay ?? []}
                  title="Refunds"
                  barColor="#b91c1c"
                  onBarClick={openCountDialog('refunds')}
                  entityLabelSingular="refund"
                />
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Credits</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Credit given over time, including credit note reasons.
              </p>
              {isLoading ? (
                <div className="h-[200px] flex items-center justify-center bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <RevenueReportChart
                  data={data?.creditsByDay ?? []}
                  title="Credits"
                  barColor="#f97316"
                />
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Voided invoices</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Invoices whose status changed to void over the period.
              </p>
              {isLoading ? (
                <div className="h-[200px] flex items-center justify-center bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <IssuesReportChart
                  data={data?.voidedInvoicesByDay ?? []}
                  title="Voided invoices"
                  barColor="#6b7280"
                  onBarClick={openCountDialog('voided')}
                  entityLabelSingular="invoice"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogKind !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{renderDialogTitle()}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
            {entities.length ? (
              entities.map((entity) => (
                <p
                  key={entity.id}
                  className="text-sm text-brand-darkBlue dark:text-brand-lightBlue"
                >
                  {entity.name}
                </p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No items for this day.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

