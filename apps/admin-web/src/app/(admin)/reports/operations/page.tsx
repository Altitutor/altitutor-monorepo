'use client';

import { useReportsContext } from '@/features/reports/context/ReportsContext';
import { ConversionInsights } from '@/features/onboarding/components/ConversionInsights';
import { OperationsStatsSection } from '@/features/reports/components/OperationsStatsSection';

export default function ReportsOperationsPage() {
  const { dateRange, visibleCharts, startDate, endDate } = useReportsContext();

  return (
    <div className="space-y-8 pt-2">
      <ConversionInsights from={startDate} to={endDate} />
      <OperationsStatsSection
        dateRange={dateRange}
        visibleCharts={visibleCharts.operations}
      />
    </div>
  );
}
