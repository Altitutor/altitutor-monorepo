'use client';

import { useEntityModals } from '@/shared/contexts/EntityModalContext';
import type { ReportEntityLink, ReportEntityPerson } from '../types';
import { useCommunicationsStatsReport } from '../hooks/useHrReports';
import { IssuesReportChart } from './IssuesReportChart';
import type { ReportsDateRange, ReportsVisibleCharts } from './ReportsDateRangeCard';

interface CommunicationsStatsSectionProps {
  dateRange: ReportsDateRange;
  visibleCharts: ReportsVisibleCharts['communications'];
}

export function CommunicationsStatsSection({
  dateRange,
  visibleCharts,
}: CommunicationsStatsSectionProps) {
  const entityModals = useEntityModals();
  const { data, isLoading, error } = useCommunicationsStatsReport(
    dateRange.start,
    dateRange.end
  );

  const handleEntityClick = (entity: { link?: ReportEntityLink }) => {
    const link = entity.link;
    if (!link) return;
    if (link.sessionId) entityModals.openSession(link.sessionId);
  };

  const handlePersonClick = (person: ReportEntityPerson) => {
    if (!person.id) return;
    if (person.kind === 'staff') entityModals.openStaff(person.id);
    else if (person.kind === 'student') entityModals.openStudent(person.id);
    else entityModals.openParent(person.id);
  };

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load communications reports. Please try again.
      </p>
    );
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
            staffMetaKeys={['staffNames']}
            onEntityClick={handleEntityClick}
            onPersonClick={handlePersonClick}
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
            staffMetaKeys={['staffNames']}
            onEntityClick={handleEntityClick}
            onPersonClick={handlePersonClick}
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
            staffMetaKeys={['staffNames']}
            onEntityClick={handleEntityClick}
            onPersonClick={handlePersonClick}
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
