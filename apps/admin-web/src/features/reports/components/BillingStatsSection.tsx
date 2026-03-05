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
import type { ReportDataPoint, ReportEntityLink, RevenueReportDataPoint } from '../types';
import { useBillingStatsReport } from '../hooks/useAdditionalReports';
import { RevenueReportChart } from './RevenueReportChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ViewInvoiceModal } from '@/features/billing';
import { ViewStudentModal } from '@/features/students';

type BillingDialogKind = 'predicted' | 'actual' | 'billingErrors' | null;
type ReportEntity = ReportDataPoint['entities'][number];

export function BillingStatsSection() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogKind, setDialogKind] = useState<BillingDialogKind>(null);
  const [selectedRevenuePoint, setSelectedRevenuePoint] =
    useState<RevenueReportDataPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ReportDataPoint | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

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
      case 'billingErrors':
        return `Billing errors on ${base}`;
      default:
        return 'Billing stats';
    }
  };

  const entities =
    selectedRevenuePoint?.entities ?? selectedPoint?.entities ?? [];

  const errorsChartData =
    data && data.predictedRevenueByDay
      ? data.predictedRevenueByDay.map((day) => {
          const date = day.date;
          const refundsPoint = data.refundsByDay.find((p) => p.date === date);
          const creditsPoint = data.creditsByDay.find((p) => p.date === date);
          const voidsPoint = data.voidedInvoicesByDay.find((p) => p.date === date);
          return {
            date,
            refunds: refundsPoint?.count ?? 0,
            credits: creditsPoint?.count ?? 0,
            voids: voidsPoint?.count ?? 0,
          };
        })
      : [];

  const handleErrorsBarClick = (date: string) => {
    if (!data) return;
    const refundsPoint = data.refundsByDay.find((p) => p.date === date);
    const creditsPoint = data.creditsByDay.find((p) => p.date === date);
    const voidsPoint = data.voidedInvoicesByDay.find((p) => p.date === date);

    const combined: ReportDataPoint = {
      date,
      count:
        (refundsPoint?.count ?? 0) +
        (creditsPoint?.count ?? 0) +
        (voidsPoint?.count ?? 0),
      entities: [
        ...(refundsPoint?.entities ?? []),
        ...(creditsPoint?.entities ?? []),
        ...(voidsPoint?.entities ?? []),
      ],
    };

    if (!combined.entities.length) return;

    setSelectedPoint(combined);
    setSelectedRevenuePoint(null);
    setDialogKind('billingErrors');
  };

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

          <div className="space-y-8">
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

          <div>
            <h3 className="text-sm font-medium mb-2">Billing errors</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Combined view of refunds, credits, and voided invoices per day.
            </p>
            {isLoading ? (
              <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={errorsChartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    onClick={(state) => {
                      const chartState = (state || null) as {
                        activePayload?: Array<{ payload?: { date?: string } | null }>;
                      } | null;
                      const payload = chartState?.activePayload?.[0]?.payload ?? null;
                      if (payload?.date) {
                        handleErrorsBarClick(payload.date);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-AU', {
                          weekday: 'short',
                          day: 'numeric',
                        });
                      }}
                    />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value, name) => [
                        value ?? 0,
                        name === 'refunds'
                          ? 'Refunds'
                          : name === 'credits'
                          ? 'Credits'
                          : 'Voided invoices',
                      ]}
                    />
                    <Bar dataKey="refunds" stackId="errors" fill="#b91c1c" />
                    <Bar dataKey="credits" stackId="errors" fill="#f97316" />
                    <Bar dataKey="voids" stackId="errors" fill="#6b7280" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
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
              entities.map((entity: ReportEntity) => {
                const link = entity.link as ReportEntityLink | undefined;
                const handleClick = () => {
                  if (!link) return;
                  if (
                    (link.kind === 'invoice' ||
                      link.kind === 'refund' ||
                      link.kind === 'credit') &&
                    link.invoiceId
                  ) {
                    setSelectedInvoiceId(link.invoiceId);
                  } else if (link.studentId) {
                    setSelectedStudentId(link.studentId);
                  }
                };
                const isClickable = !!entity.link;

                return (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={handleClick}
                    disabled={!isClickable}
                    className={`block w-full text-left text-sm ${
                      isClickable
                        ? 'text-brand-darkBlue hover:underline dark:text-brand-lightBlue'
                        : 'text-muted-foreground cursor-default'
                    }`}
                  >
                    {entity.name}
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                No items for this day.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ViewInvoiceModal
        isOpen={!!selectedInvoiceId}
        invoiceId={selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
      />

      <ViewStudentModal
        isOpen={!!selectedStudentId}
        studentId={selectedStudentId}
        onClose={() => setSelectedStudentId(null)}
        onStudentUpdated={() => {}}
      />
    </>
  );
}

