'use client';

import { CommunicationsStatsSection } from '@/features/reports/components/HrStatsSection';
import { useReportsContext } from '@/features/reports/context/ReportsContext';

export default function ReportsCommunicationsPage() {
  const { dateRange, visibleCharts } = useReportsContext();

  return (
    <CommunicationsStatsSection
      dateRange={dateRange}
      visibleCharts={visibleCharts.communications}
    />
  );
}
