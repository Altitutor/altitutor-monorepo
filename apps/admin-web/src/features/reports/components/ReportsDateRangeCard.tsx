import { subDays } from 'date-fns';

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
    subsidiesEnrolled: 'Subsidies (enrolled in class)',
  },
} as const;

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
    subsidiesEnrolled: boolean;
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
      subsidiesEnrolled: true,
    },
  };
}

export const DEFAULT_VISIBLE_CHARTS = buildDefaultVisibleCharts();

export function getDefaultReportsDateRange(): ReportsDateRange {
  const end = new Date();
  const start = subDays(end, 6);
  return { start, end };
}
