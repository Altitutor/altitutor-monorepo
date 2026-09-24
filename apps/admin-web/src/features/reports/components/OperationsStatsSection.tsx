'use client';

import {
  useIssuesReport,
  useTasksReport,
  useProjectsReport,
} from '../hooks/useIssuesReport';
import { IssuesReportChart } from './IssuesReportChart';
import type { ReportsDateRange, ReportsVisibleCharts } from './ReportsDateRangeCard';
import { useEntityModals } from '@/shared/contexts/EntityModalContext';

interface OperationsStatsSectionProps {
  dateRange: ReportsDateRange;
  visibleCharts: ReportsVisibleCharts['operations'];
}

export function OperationsStatsSection({ dateRange, visibleCharts }: OperationsStatsSectionProps) {
  const entityModals = useEntityModals();

  const { data: issuesData, isLoading: issuesLoading, error: issuesError } = useIssuesReport(
    dateRange.start,
    dateRange.end
  );
  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useTasksReport(
    dateRange.start,
    dateRange.end
  );
  const { data: projectsData, isLoading: projectsLoading, error: projectsError } = useProjectsReport(
    dateRange.start,
    dateRange.end
  );

  const handleEntityClick = (entity: {
    id: string;
    link?: { kind: string; taskId?: string | null };
  }) => {
    const kind = entity.link?.kind ?? 'issue';
    if (kind === 'issue') {
      entityModals.openIssue(entity.id);
    } else if (kind === 'project') {
      entityModals.openProject(entity.id);
    } else if (kind === 'task') {
      const taskId = entity.link?.taskId ?? entity.id;
      entityModals.openTask(taskId);
    }
  };

  return (
    <>
    <div className="space-y-8">
        {issuesError && (
          <p className="text-sm text-destructive">
            Failed to load issues report. Please try again.
          </p>
        )}
        {tasksError && (
          <p className="text-sm text-destructive">
            Failed to load tasks report. Please try again.
          </p>
        )}
        {projectsError && (
          <p className="text-sm text-destructive">
            Failed to load projects report. Please try again.
          </p>
        )}

        {/* Tasks */}
        {(visibleCharts.tasks.openTasks || visibleCharts.tasks.completedTasks) && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold">Tasks</h3>
            <div className="space-y-8">
              {visibleCharts.tasks.openTasks && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Open tasks at end of day</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Number of tasks that were open (not done) at the end of each day
                  </p>
                  {tasksLoading ? (
                    <div className="h-[280px] flex items-center justify-center bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  ) : (
                    <IssuesReportChart
                      data={tasksData?.openByDay ?? []}
                      title="Open tasks"
                      entityLabelSingular="task"
                      tableVariant="openTasks"
                      totalMode="latest"
                      staffMetaKeys={['assignee']}
                      onEntityClick={handleEntityClick}
                    />
                  )}
                </div>
              )}
              {visibleCharts.tasks.completedTasks && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Completed tasks within period</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Number of tasks completed on each day
                  </p>
                  {tasksLoading ? (
                    <div className="h-[280px] flex items-center justify-center bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  ) : (
                    <IssuesReportChart
                      data={tasksData?.completedByDay ?? []}
                      title="Completed tasks"
                      entityLabelSingular="task"
                      tableVariant="completedTasks"
                      staffMetaKeys={['completedBy']}
                      onEntityClick={handleEntityClick}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Issues */}
        {(visibleCharts.issues.openIssues || visibleCharts.issues.resolvedIssues) && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold">Issues</h3>
            <div className="space-y-8">
              {visibleCharts.issues.openIssues && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Open issues at end of day</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Number of issues that were open (not resolved) at the end of each day
                  </p>
                  {issuesLoading ? (
                    <div className="h-[280px] flex items-center justify-center bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  ) : (
                    <IssuesReportChart
                      data={issuesData?.openByDay ?? []}
                      title="Open issues"
                      entityLabelSingular="issue"
                      tableVariant="openIssues"
                      totalMode="latest"
                      staffMetaKeys={['createdBy']}
                      onEntityClick={handleEntityClick}
                    />
                  )}
                </div>
              )}
              {visibleCharts.issues.resolvedIssues && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Resolved issues within period</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Number of issues resolved on each day
                  </p>
                  {issuesLoading ? (
                    <div className="h-[280px] flex items-center justify-center bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  ) : (
                    <IssuesReportChart
                      data={issuesData?.resolvedByDay ?? []}
                      title="Resolved issues"
                      entityLabelSingular="issue"
                      tableVariant="resolvedIssues"
                      staffMetaKeys={['resolvedBy']}
                      onEntityClick={handleEntityClick}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Projects */}
        {(visibleCharts.projects.openProjects || visibleCharts.projects.finishedProjects) && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold">Projects</h3>
            <div className="space-y-8">
              {visibleCharts.projects.openProjects && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Open projects at end of day</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Number of projects that were open (not completed) at the end of each day
                  </p>
                  {projectsLoading ? (
                    <div className="h-[280px] flex items-center justify-center bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  ) : (
                    <IssuesReportChart
                      data={projectsData?.openByDay ?? []}
                      title="Open projects"
                      entityLabelSingular="project"
                      tableVariant="openProjects"
                      totalMode="latest"
                      staffMetaKeys={['projectLead']}
                      onEntityClick={handleEntityClick}
                    />
                  )}
                </div>
              )}
              {visibleCharts.projects.finishedProjects && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Finished projects within period</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Number of projects completed on each day
                  </p>
                  {projectsLoading ? (
                    <div className="h-[280px] flex items-center justify-center bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  ) : (
                    <IssuesReportChart
                      data={projectsData?.finishedByDay ?? []}
                      title="Finished projects"
                      entityLabelSingular="project"
                      tableVariant="finishedProjects"
                      staffMetaKeys={['projectLead']}
                      onEntityClick={handleEntityClick}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
    </div>
    </>
  );
}
