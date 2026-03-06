'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from '@altitutor/ui';
import { Calendar, ChevronDown } from 'lucide-react';
import { format, subDays } from 'date-fns';

const TODAY = format(new Date(), 'yyyy-MM-dd');

export interface ReportsDateRange {
  start: Date;
  end: Date;
}

export const REPORTS_SECTION_KEYS = [
  'operations',
  'scheduling',
  'financial',
] as const;

export type ReportsSectionKey = (typeof REPORTS_SECTION_KEYS)[number];

export const REPORTS_SECTION_LABELS: Record<ReportsSectionKey, string> = {
  operations: 'Operations',
  scheduling: 'Scheduling',
  financial: 'Financial',
};

export const REPORTS_CHART_CONFIG = {
  operations: {
    tasks: {
      openTasks: 'Open tasks',
      completedTasks: 'Completed tasks',
    },
    issues: {
      openIssues: 'Open issues',
      resolvedIssues: 'Resolved issues',
    },
    projects: {
      openProjects: 'Open projects',
    },
  },
  scheduling: {
    students: {
      activeStudents: 'Active students',
      registrations: 'Student registrations',
      discontinuations: 'Student discontinuations',
      absences: 'Student absences',
    },
    staff: {
      absences: 'Staff absences',
    },
    classes: {
      activeClasses: 'Active classes',
      enrolments: 'Class enrolments',
      unenrolments: 'Class unenrolments',
    },
  },
  financial: {
    predictedRevenue: 'Predicted revenue',
    actualRevenue: 'Actual revenue',
    billingErrors: 'Billing errors',
  },
} as const;

export type ReportsChartKey<K extends ReportsSectionKey> =
  keyof (typeof REPORTS_CHART_CONFIG)[K];

export type OperationsSubsection = keyof (typeof REPORTS_CHART_CONFIG)['operations'];
export type SchedulingSubsection = keyof (typeof REPORTS_CHART_CONFIG)['scheduling'];

export type ReportsVisibleCharts = {
  operations: {
    tasks: { openTasks: boolean; completedTasks: boolean };
    issues: { openIssues: boolean; resolvedIssues: boolean };
    projects: { openProjects: boolean };
  };
  scheduling: {
    students: {
      activeStudents: boolean;
      registrations: boolean;
      discontinuations: boolean;
      absences: boolean;
    };
    staff: { absences: boolean };
    classes: {
      activeClasses: boolean;
      enrolments: boolean;
      unenrolments: boolean;
    };
  };
  financial: {
    predictedRevenue: boolean;
    actualRevenue: boolean;
    billingErrors: boolean;
  };
};

function buildDefaultVisibleCharts(): ReportsVisibleCharts {
  return {
    operations: {
      tasks: { openTasks: true, completedTasks: true },
      issues: { openIssues: true, resolvedIssues: true },
      projects: { openProjects: true },
    },
    scheduling: {
      students: {
        activeStudents: true,
        registrations: true,
        discontinuations: true,
        absences: true,
      },
      staff: { absences: true },
      classes: {
        activeClasses: true,
        enrolments: true,
        unenrolments: true,
      },
    },
    financial: {
      predictedRevenue: true,
      actualRevenue: true,
      billingErrors: true,
    },
  };
}

export const DEFAULT_VISIBLE_CHARTS = buildDefaultVisibleCharts();

function isSchedulingSubsectionVisible(
  subsection: Record<string, boolean>
): boolean {
  return Object.values(subsection).some((v) => v);
}

function isOperationsSubsectionVisible(
  subsection: Record<string, boolean>
): boolean {
  return Object.values(subsection).some((v) => v);
}

export function isSectionVisible(
  visibleCharts: ReportsVisibleCharts,
  section: ReportsSectionKey
): boolean {
  if (section === 'operations') {
    return Object.values(visibleCharts.operations).some(
      isOperationsSubsectionVisible
    );
  }
  if (section === 'scheduling') {
    return Object.values(visibleCharts.scheduling).some(
      isSchedulingSubsectionVisible
    );
  }
  return Object.values(visibleCharts[section]).some((v) => v);
}

interface ReportsDateRangeCardProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  visibleCharts: ReportsVisibleCharts;
  onVisibleChartsChange: (charts: ReportsVisibleCharts) => void;
}

export function getDefaultReportsDateRange(): ReportsDateRange {
  const end = new Date();
  const start = subDays(end, 6);
  return { start, end };
}

export function ReportsDateRangeCard({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  visibleCharts,
  onVisibleChartsChange,
}: ReportsDateRangeCardProps) {
  const handleStartChange = (value: string) => {
    if (!value) return;
    if (value > TODAY) {
      onStartDateChange(TODAY);
      return;
    }
    if (value > endDate) {
      onEndDateChange(value);
    }
    onStartDateChange(value);
  };

  const handleEndChange = (value: string) => {
    if (!value) return;
    if (value > TODAY) {
      onEndDateChange(TODAY);
      return;
    }
    if (value < startDate) {
      onStartDateChange(value);
    }
    onEndDateChange(value);
  };

  const handleOperationsChartToggle = (
    subsection: OperationsSubsection,
    chart: string,
    checked: boolean
  ) => {
    onVisibleChartsChange({
      ...visibleCharts,
      operations: {
        ...visibleCharts.operations,
        [subsection]: {
          ...visibleCharts.operations[subsection],
          [chart]: checked,
        },
      },
    });
  };

  const handleSchedulingChartToggle = (
    subsection: SchedulingSubsection,
    chart: string,
    checked: boolean
  ) => {
    onVisibleChartsChange({
      ...visibleCharts,
      scheduling: {
        ...visibleCharts.scheduling,
        [subsection]: {
          ...visibleCharts.scheduling[subsection],
          [chart]: checked,
        },
      },
    });
  };

  const handleFinancialChartToggle = (
    chart: keyof ReportsVisibleCharts['financial'],
    checked: boolean
  ) => {
    onVisibleChartsChange({
      ...visibleCharts,
      financial: { ...visibleCharts.financial, [chart]: checked },
    });
  };

  const OPERATIONS_SUBSECTION_LABELS: Record<OperationsSubsection, string> = {
    tasks: 'Tasks',
    issues: 'Issues',
    projects: 'Projects',
  };

  const SCHEDULING_SUBSECTION_LABELS: Record<SchedulingSubsection, string> = {
    students: 'Students',
    staff: 'Staff',
    classes: 'Classes',
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Input
            id="reports-start-date"
            type="date"
            value={startDate}
            onChange={(e) => handleStartChange(e.target.value)}
            max={TODAY}
            className="h-9 w-[140px]"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            id="reports-end-date"
            type="date"
            value={endDate}
            onChange={(e) => handleEndChange(e.target.value)}
            max={TODAY}
            className="h-9 w-[140px]"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Calendar className="h-4 w-4 mr-2" />
              View options
              <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-[min(400px,80vh)] overflow-y-auto">
            {/* Operations */}
            {(Object.keys(REPORTS_CHART_CONFIG.operations) as OperationsSubsection[]).map(
              (subsection) => (
                <div key={subsection}>
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {OPERATIONS_SUBSECTION_LABELS[subsection]}
                  </DropdownMenuLabel>
                  {(Object.keys(
                    REPORTS_CHART_CONFIG.operations[subsection]
                  ) as string[]).map((chartKey) => (
                    <DropdownMenuCheckboxItem
                      key={chartKey}
                      checked={
                        visibleCharts.operations[subsection][
                          chartKey as keyof (typeof visibleCharts.operations)[typeof subsection]
                        ]
                      }
                      onCheckedChange={(checked) =>
                        handleOperationsChartToggle(
                          subsection,
                          chartKey,
                          checked === true
                        )
                      }
                    >
                      {
                        (REPORTS_CHART_CONFIG.operations[subsection] as Record<string, string>)[
                          chartKey
                        ]
                      }
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              )
            )}
            <DropdownMenuSeparator />
            {/* Scheduling */}
            {(Object.keys(REPORTS_CHART_CONFIG.scheduling) as SchedulingSubsection[]).map(
              (subsection) => (
                <div key={subsection}>
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {SCHEDULING_SUBSECTION_LABELS[subsection]}
                  </DropdownMenuLabel>
                  {(Object.keys(
                    REPORTS_CHART_CONFIG.scheduling[subsection]
                  ) as string[]).map((chartKey) => (
                    <DropdownMenuCheckboxItem
                      key={chartKey}
                      checked={
                        visibleCharts.scheduling[subsection][
                          chartKey as keyof (typeof visibleCharts.scheduling)[typeof subsection]
                        ]
                      }
                      onCheckedChange={(checked) =>
                        handleSchedulingChartToggle(
                          subsection,
                          chartKey,
                          checked === true
                        )
                      }
                    >
                      {
                        (REPORTS_CHART_CONFIG.scheduling[subsection] as Record<string, string>)[
                          chartKey
                        ]
                      }
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              )
            )}
            <DropdownMenuSeparator />
            {/* Financial */}
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {REPORTS_SECTION_LABELS.financial}
            </DropdownMenuLabel>
            {(
              Object.keys(REPORTS_CHART_CONFIG.financial) as Array<
                keyof typeof REPORTS_CHART_CONFIG.financial
              >
            ).map((chartKey) => (
              <DropdownMenuCheckboxItem
                key={chartKey}
                checked={visibleCharts.financial[chartKey]}
                onCheckedChange={(checked) =>
                  handleFinancialChartToggle(chartKey, checked === true)
                }
              >
                {REPORTS_CHART_CONFIG.financial[chartKey]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
