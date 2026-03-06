'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { GraduationCap, CalendarDays, Users, LineChart } from 'lucide-react';
import { useActiveStudentsCount } from '@/features/students';
import { useActiveClassesCount, useCurrentEnrollmentsCount } from '@/features/classes';
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
  const { data: activeStudentsCount, isLoading: loadingStudents } = useActiveStudentsCount();
  const { data: activeClassesCount, isLoading: loadingClasses } = useActiveClassesCount();
  const { data: currentEnrollmentsCount, isLoading: loadingEnrollments } = useCurrentEnrollmentsCount();

  const loading = loadingStudents || loadingClasses || loadingEnrollments;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">View system statistics and analytics</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Active Students</p>
                <p className="text-2xl font-bold">{loading ? '...' : (activeStudentsCount ?? 0)}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CalendarDays className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Active Classes</p>
                <p className="text-2xl font-bold">{loading ? '...' : (activeClassesCount ?? 0)}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Class Enrollments</p>
                <p className="text-2xl font-bold">{loading ? '...' : (currentEnrollmentsCount ?? 0)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <LineChart className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Detailed stats</h2>
        </div>

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


