'use client';

import { useEntityModals } from '@/shared/contexts/EntityModalContext';
import type { ReportEntityLink } from '../types';
import { useHrStatsReport } from '../hooks/useHrReports';
import { IssuesReportChart } from './IssuesReportChart';
import type { ReportsDateRange, ReportsVisibleCharts } from './ReportsDateRangeCard';

interface HrStatsSectionProps {
  dateRange: ReportsDateRange;
  visibleCharts: ReportsVisibleCharts['hr'];
}

export function HrStatsSection({ dateRange, visibleCharts }: HrStatsSectionProps) {
  const entityModals = useEntityModals();
  const { data, isLoading, error } = useHrStatsReport(dateRange.start, dateRange.end);

  const handleEntityClick = (entity: { link?: ReportEntityLink }) => {
    const link = entity.link;
    if (!link) return;
    if (link.staffId) entityModals.openStaff(link.staffId);
    else if (link.studentId) entityModals.openStudent(link.studentId);
    else if (link.sessionId) entityModals.openSession(link.sessionId);
  };

  if (error) {
    return <p className="text-sm text-destructive">Failed to load HR reports. Please try again.</p>;
  }

  if (isLoading) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg bg-muted/30">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {visibleCharts.staffCheckIns && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Staff check-ins</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Completed check-ins for staff members receiving a check-in.
          </p>
          <IssuesReportChart
            data={data?.staffCheckInsByDay ?? []}
            title="Staff check-ins"
            entityLabelSingular="check-in"
            tableVariant="staffCheckIns"
            staffMetaKeys={['staff']}
            onEntityClick={handleEntityClick}
          />
        </section>
      )}

      {visibleCharts.studentCheckIns && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Student check-ins</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Completed check-ins attended by students.
          </p>
          <IssuesReportChart
            data={data?.studentCheckInsByDay ?? []}
            title="Student check-ins"
            entityLabelSingular="check-in"
            tableVariant="studentCheckIns"
            staffMetaKeys={['loggedBy']}
            onEntityClick={handleEntityClick}
          />
        </section>
      )}

      {visibleCharts.parentCheckIns && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Parent check-ins</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Completed check-ins attended by parents.
          </p>
          <IssuesReportChart
            data={data?.parentCheckInsByDay ?? []}
            title="Parent check-ins"
            entityLabelSingular="check-in"
            tableVariant="parentCheckIns"
            staffMetaKeys={['loggedBy']}
            onEntityClick={handleEntityClick}
          />
        </section>
      )}

      {visibleCharts.formCompletions && (
        <section className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium">Form completions</h3>
            <p className="text-xs text-muted-foreground">
              Submitted form responses, broken down by form type.
            </p>
          </div>
          {(data?.formCompletionsByType ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No form completions in this period.</p>
          ) : (
            data?.formCompletionsByType.map((completionType) => (
              <div key={completionType.type}>
                <h4 className="mb-3 text-sm font-medium">{completionType.label}</h4>
                <IssuesReportChart
                  data={completionType.data}
                  title={`${completionType.label} form completions`}
                  entityLabelSingular="completion"
                  tableVariant="formCompletions"
                  staffMetaKeys={['loggedBy']}
                />
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}

