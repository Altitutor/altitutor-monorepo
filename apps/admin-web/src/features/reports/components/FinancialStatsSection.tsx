'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@altitutor/ui';
import { CreditCard } from 'lucide-react';
import type { ReportDataPoint, ReportEntityLink, RevenueReportDataPoint } from '../types';
import { useBillingStatsReport } from '../hooks/useAdditionalReports';
import { RevenueReportChart } from './RevenueReportChart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ReportsDateRange, ReportsVisibleCharts } from './ReportsDateRangeCard';
import { ViewInvoiceModal } from '@/features/billing';
import { ViewStudentModal } from '@/features/students';

function getBillingErrorsDeduplicatedEntities(
  refundsByDay: ReportDataPoint[],
  creditsByDay: RevenueReportDataPoint[],
  voidedInvoicesByDay: ReportDataPoint[]
): ReportDataPoint['entities'] {
  const seen = new Set<string>();
  const result: ReportDataPoint['entities'] = [];

  const addFrom = (points: ReportDataPoint[]) => {
    for (const point of points) {
      for (const entity of point.entities) {
        if (!seen.has(entity.id)) {
          seen.add(entity.id);
          result.push(entity);
        }
      }
    }
  };

  addFrom(refundsByDay);
  addFrom(creditsByDay);
  addFrom(voidedInvoicesByDay);

  return result;
}

interface FinancialStatsSectionProps {
  dateRange: ReportsDateRange;
  visibleCharts: ReportsVisibleCharts['financial'];
}

export function FinancialStatsSection({ dateRange, visibleCharts }: FinancialStatsSectionProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const { data, isLoading, error } = useBillingStatsReport(dateRange.start, dateRange.end);

  const handleBillingEntityClick = (entity: { link?: ReportEntityLink }) => {
    const link = entity.link;
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

  const billingErrorsEntities = data
    ? getBillingErrorsDeduplicatedEntities(
        data.refundsByDay,
        data.creditsByDay,
        data.voidedInvoicesByDay
      )
    : [];
  const billingErrorsCount = billingErrorsEntities.length;

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Financial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {error && (
          <p className="text-sm text-destructive">
            Failed to load financial stats. Please try again.
          </p>
        )}

        <div className="space-y-8">
          {visibleCharts.predictedRevenue && (
          <div>
            <h3 className="text-sm font-medium mb-2">Predicted revenue</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Sum of expected session charges for each day: sessions_students without planned
              absences × calculated price per student (billing type, subject, subsidies).
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
          )}

          {visibleCharts.actualRevenue && (
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
                onEntityClick={handleBillingEntityClick}
              />
            )}
          </div>
          )}
        </div>

        {visibleCharts.billingErrors && (
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
            <div className="flex gap-4">
              <div className="h-[220px] flex-1 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={errorsChartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
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
              <Card className="w-64 shrink-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Billing errors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-bold">{billingErrorsCount}</p>
                  <p className="text-xs text-muted-foreground">
                    {billingErrorsCount === 1
                      ? 'Refund, credit or void in range'
                      : 'Refunds, credits and voids in range'}
                  </p>
                  {billingErrorsEntities.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {billingErrorsEntities.map((entity) => {
                        const isClickable = !!entity.link;
                        return isClickable ? (
                          <button
                            key={entity.id}
                            type="button"
                            onClick={() => handleBillingEntityClick(entity)}
                            className="w-full text-left text-sm text-brand-darkBlue hover:underline dark:text-brand-lightBlue truncate"
                            title={entity.name}
                          >
                            {entity.name}
                          </button>
                        ) : (
                          <p
                            key={entity.id}
                            className="text-sm truncate"
                            title={entity.name}
                          >
                            {entity.name}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        )}
      </CardContent>
    </Card>

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
