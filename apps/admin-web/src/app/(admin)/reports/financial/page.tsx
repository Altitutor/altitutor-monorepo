'use client';

import { useReportsContext } from '@/features/reports/context/ReportsContext';
import { FinancialStatsSection } from '@/features/reports/components/FinancialStatsSection';

export default function ReportsFinancialPage() {
  const { dateRange, visibleCharts } = useReportsContext();

  return (
    <div className="space-y-8 pt-2">
      <FinancialStatsSection
        dateRange={dateRange}
        visibleCharts={visibleCharts.financial}
      />
    </div>
  );
}
