'use client';

import { useState } from 'react';
import type { ReportDataPoint, ReportEntityLink, RevenueReportDataPoint } from '../types';
import { useBillingStatsReport } from '../hooks/useAdditionalReports';
import { RevenueReportChart } from './RevenueReportChart';
import { ReportsEntitiesTable } from './ReportsEntitiesTable';
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
import { SessionModal } from '@/features/sessions/components/SessionModal';

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

function BillingErrorsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: { date: string; refunds?: number; credits?: number; voids?: number };
  }>;
}) {
  if (!active || !payload?.length) return null;

  const { date, refunds = 0, credits = 0, voids = 0 } = payload[0].payload;

  return (
    <div className="rounded-lg border bg-background dark:bg-brand-dark-bg px-3 py-2 shadow-md">
      <p className="font-medium">{date}</p>
      <p className="text-sm text-muted-foreground">
        Refunds: {refunds}, Credits: {credits}, Voided invoices: {voids}
      </p>
    </div>
  );
}

function SubsidiesTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: { date: string; count: number };
  }>;
}) {
  if (!active || !payload?.length) return null;

  const { date, count } = payload[0].payload;

  return (
    <div className="rounded-lg border bg-background dark:bg-brand-dark-bg px-3 py-2 shadow-md">
      <p className="font-medium">{date}</p>
      <p className="text-sm text-muted-foreground">Subsidies: {count}</p>
    </div>
  );
}

export function FinancialStatsSection({ dateRange, visibleCharts }: FinancialStatsSectionProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { data, isLoading, error } = useBillingStatsReport(dateRange.start, dateRange.end);

  const handleBillingEntityClick = (entity: { link?: ReportEntityLink }) => {
    const link = entity.link;
    if (!link) return;
    if (link.kind === 'session' && link.sessionId) {
      setSelectedSessionId(link.sessionId);
    } else if (
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

  const handleSubsidyEntityClick = (entity: { link?: ReportEntityLink }) => {
    const link = entity.link;
    if (link?.studentId) setSelectedStudentId(link.studentId);
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

  return (
    <>
    <div className="space-y-8">
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
                tableVariant="predictedRevenue"
                onEntityClick={handleBillingEntityClick}
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
                tableVariant="actualRevenue"
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
              <div className="space-y-4">
                <div className="h-[220px]">
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
                      <Tooltip content={<BillingErrorsTooltip />} />
                      <Bar
                        dataKey="refunds"
                        stackId="errors"
                        fill="hsl(var(--primary))"
                      />
                      <Bar
                        dataKey="credits"
                        stackId="errors"
                        fill="hsl(var(--primary) / 0.7)"
                      />
                      <Bar
                        dataKey="voids"
                        stackId="errors"
                        fill="hsl(var(--primary) / 0.4)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ReportsEntitiesTable
                  entities={billingErrorsEntities}
                  variant="billingErrors"
                  onEntityClick={handleBillingEntityClick}
                />
              </div>
            )}
          </div>
        )}

        {visibleCharts.subsidiesEnrolled && (
          <div>
            <h3 className="text-sm font-medium mb-2">Subsidies (enrolled in class)</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Number of student subsidies that are effective and where the student is
              enrolled in a class for that subject, per day.
            </p>
            {isLoading ? (
              <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.subsidiesEnrolledByDay ?? []}
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
                      <Tooltip content={<SubsidiesTooltip />} />
                      <Bar
                        dataKey="count"
                        name="Subsidies"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ReportsEntitiesTable
                  entities={
                    (() => {
                      const all = data?.subsidiesEnrolledByDay?.flatMap(
                        (d) => d.entities
                      ) ?? [];
                      const seen = new Set<string>();
                      return all.filter((e) => {
                        const key = `${e.meta?.student ?? ''}-${e.meta?.class ?? ''}-${e.meta?.price ?? ''}`;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                      });
                    })()
                  }
                  variant="subsidies"
                  onEntityClick={handleSubsidyEntityClick}
                />
              </div>
            )}
          </div>
        )}

        {visibleCharts.subsidiesCreated && (
          <div>
            <h3 className="text-sm font-medium mb-2">Subsidies</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Number of student subsidies created on each day in the selected period.
            </p>
            {isLoading ? (
              <div className="h-[220px] flex items-center justify-center bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.subsidiesCreatedByDay ?? []}
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
                      <Tooltip content={<SubsidiesTooltip />} />
                      <Bar
                        dataKey="count"
                        name="Subsidies"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ReportsEntitiesTable
                  entities={data?.subsidiesCreatedByDay?.flatMap((day) => day.entities) ?? []}
                  variant="subsidiesCreated"
                  onEntityClick={handleSubsidyEntityClick}
                />
              </div>
            )}
          </div>
        )}
    </div>

    <SessionModal
      isOpen={!!selectedSessionId}
      sessionId={selectedSessionId}
      onClose={() => setSelectedSessionId(null)}
    />

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
