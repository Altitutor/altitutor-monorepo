'use client';

import { useState, useMemo } from 'react';
import {
  OperationsStatsSection,
  SchedulingStatsSection,
  FinancialStatsSection,
  ReportsDateRangeCard,
  getDefaultReportsDateRange,
  DEFAULT_VISIBLE_CHARTS,
  isSectionVisible,
} from '@/features/reports';
import { format } from 'date-fns';

export default function ReportsPage() {
  const defaultRange = useMemo(() => getDefaultReportsDateRange(), []);
  const [startDate, setStartDate] = useState(() => format(defaultRange.start, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(defaultRange.end, 'yyyy-MM-dd'));
  const [visibleCharts, setVisibleCharts] = useState(DEFAULT_VISIBLE_CHARTS);

  const dateRange = useMemo(
    () => ({
      start: new Date(startDate),
      end: new Date(endDate),
    }),
    [startDate, endDate]
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">View system statistics and analytics</p>
      </div>

      <div className="space-y-6">
        <ReportsDateRangeCard
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          visibleCharts={visibleCharts}
          onVisibleChartsChange={setVisibleCharts}
        />

        <div className="space-y-6">
          {isSectionVisible(visibleCharts, 'operations') && (
            <OperationsStatsSection dateRange={dateRange} visibleCharts={visibleCharts.operations} />
          )}
          {isSectionVisible(visibleCharts, 'scheduling') && (
            <SchedulingStatsSection dateRange={dateRange} visibleCharts={visibleCharts.scheduling} />
          )}
          {isSectionVisible(visibleCharts, 'financial') && (
            <FinancialStatsSection dateRange={dateRange} visibleCharts={visibleCharts.financial} />
          )}
        </div>
      </div>
    </div>
  );
}


