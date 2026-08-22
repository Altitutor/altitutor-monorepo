'use client';

import { HrStatsSection } from '@/features/reports/components/HrStatsSection';
import { useReportsContext } from '@/features/reports/context/ReportsContext';

export default function ReportsHrPage() {
  const { dateRange, visibleCharts } = useReportsContext();

  return <HrStatsSection dateRange={dateRange} visibleCharts={visibleCharts.hr} />;
}

