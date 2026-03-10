'use client';

import { useReportsContext } from '@/features/reports/context/ReportsContext';
import { SchedulingStatsSection } from '@/features/reports/components/SchedulingStatsSection';

export default function ReportsSchedulingPage() {
  const { dateRange, visibleCharts } = useReportsContext();

  return (
    <div className="space-y-8 pt-2">
      <SchedulingStatsSection
        dateRange={dateRange}
        visibleCharts={visibleCharts.scheduling}
      />
    </div>
  );
}
