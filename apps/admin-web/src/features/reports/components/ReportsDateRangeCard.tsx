import {
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
} from 'date-fns';
import type { SmartDatePickerPreset } from '@altitutor/ui';

export interface ReportsDateRange {
  start: Date;
  end: Date;
}

export const REPORTS_SECTION_KEYS = [
  'operations',
  'scheduling',
  'financial',
  'communications',
] as const;

export type ReportsSectionKey = (typeof REPORTS_SECTION_KEYS)[number];

export const REPORTS_SECTION_LABELS: Record<ReportsSectionKey, string> = {
  operations: 'Operations',
  scheduling: 'Scheduling',
  financial: 'Financial',
  communications: 'Communications',
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
      finishedProjects: 'Finished projects',
    },
  },
  scheduling: {
    sessions: {
      trialSessions: 'Trial sessions',
    },
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
    subsidiesCreated: 'Subsidies',
  },
  communications: {
    staffCheckIns: 'Staff check-ins',
    studentCheckIns: 'Student check-ins',
    parentCheckIns: 'Parent check-ins',
    formCompletions: 'Form completions',
  },
} as const;

export type OperationsSubsection = keyof (typeof REPORTS_CHART_CONFIG)['operations'];
export type SchedulingSubsection = keyof (typeof REPORTS_CHART_CONFIG)['scheduling'];

export type ReportsVisibleCharts = {
  operations: {
    tasks: { openTasks: boolean; completedTasks: boolean };
    issues: { openIssues: boolean; resolvedIssues: boolean };
    projects: { openProjects: boolean; finishedProjects: boolean };
  };
  scheduling: {
    sessions: { trialSessions: boolean };
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
    subsidiesCreated: boolean;
  };
  communications: {
    staffCheckIns: boolean;
    studentCheckIns: boolean;
    parentCheckIns: boolean;
    formCompletions: boolean;
  };
};

function buildDefaultVisibleCharts(): ReportsVisibleCharts {
  return {
    operations: {
      tasks: { openTasks: false, completedTasks: true },
      issues: { openIssues: false, resolvedIssues: true },
      projects: { openProjects: false, finishedProjects: true },
    },
    scheduling: {
      sessions: { trialSessions: true },
      students: {
        activeStudents: false,
        registrations: true,
        discontinuations: true,
        absences: true,
      },
      staff: { absences: true },
      classes: {
        activeClasses: false,
        enrolments: true,
        unenrolments: true,
      },
    },
    financial: {
      predictedRevenue: true,
      actualRevenue: true,
      billingErrors: true,
      subsidiesEnrolled: false,
      subsidiesCreated: true,
    },
    communications: {
      staffCheckIns: true,
      studentCheckIns: true,
      parentCheckIns: true,
      formCompletions: true,
    },
  };
}

export const DEFAULT_VISIBLE_CHARTS = buildDefaultVisibleCharts();

export function getDefaultReportsDateRange(): ReportsDateRange {
  const end = new Date();
  const start = subDays(end, 6);
  return { start, end };
}

export function getReportsDatePresets(
  referenceDate = new Date(),
  lastAdminMeetingDate?: Date | null
): SmartDatePickerPreset[] {
  const presets: SmartDatePickerPreset[] = [
    { label: 'Today', value: referenceDate },
    { label: 'Yesterday', value: subDays(referenceDate, 1) },
  ];

  if (lastAdminMeetingDate) {
    presets.push({ label: 'Last admin meeting', value: lastAdminMeetingDate });
  }

  presets.push(
    {
      label: 'Last week',
      value: startOfWeek(subDays(referenceDate, 7), { weekStartsOn: 1 }),
    },
    { label: 'Start of this month', value: startOfMonth(referenceDate) },
    { label: 'Start of this quarter', value: startOfQuarter(referenceDate) },
    { label: 'Start of this year', value: startOfYear(referenceDate) }
  );

  return presets;
}
