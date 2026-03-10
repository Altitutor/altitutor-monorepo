'use client';

import { useReportsContext } from '@/features/reports/context/ReportsContext';
import { OperationsStatsSection } from '@/features/reports/components/OperationsStatsSection';

export default function ReportsOperationsPage() {
  const { dateRange, visibleCharts } = useReportsContext();

  return (
    <div className="space-y-8 pt-2">
      <OperationsStatsSection
        dateRange={dateRange}
        visibleCharts={visibleCharts.operations}
      />
    </div>
  );
}
