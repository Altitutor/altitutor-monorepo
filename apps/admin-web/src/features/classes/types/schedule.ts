import type { Enums } from '@altitutor/shared';

export type ClassBillingType = Enums<'billing_type'>;
export type ScheduledOfferingType = Extract<Enums<'session_type'>, 'CLASS' | 'HOMEWORK_HELP'>;

export interface ClassScheduleRow {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
}

export interface ClassScheduleFormValues {
  classId: string;
  sessionType: ScheduledOfferingType;
  subjectId: string | null;
  billingType: ClassBillingType | null;
  cohortLabel: string;
  startDate: string;
  endDate: string;
  effectiveFrom?: string;
  anchorDate?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  frequencyWeeks: 1 | 2;
  rows: ClassScheduleRow[];
}

export interface ClassScheduleProposal {
  class_id: string;
  session_type: ScheduledOfferingType;
  subject_id: string | null;
  billing_type: ClassBillingType | null;
  cohort_label: string;
  status: 'ACTIVE' | 'INACTIVE';
  schedule_type: 'RECURRING';
  start_date: string;
  end_date: string;
  effective_from: string;
  timezone: string;
  frequency_weeks: 1 | 2;
  anchor_date: string;
  recurring_rows: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    room: string | null;
    position: number;
  }>;
}

export interface ClassSchedulePlanOccurrence {
  source_key: string;
  start_at: string;
  end_at: string;
  room: string | null;
  action: 'CREATE' | 'PRESERVE';
}

export interface ClassSchedulePlanRemoval {
  session_id: string;
  start_at: string;
  end_at: string;
  action: 'CANCEL' | 'PROTECTED';
}

export interface ClassSchedulePlan {
  proposal_hash: string;
  counts: {
    create: number;
    update: number;
    delete: number;
    cancel: number;
    preserve: number;
    protected: number;
  };
  occurrences: ClassSchedulePlanOccurrence[];
  removals: ClassSchedulePlanRemoval[];
  conflicts: Array<{ message: string }>;
  class_id?: string;
  schedule_revision_id?: string;
}

export interface StoredClassSchedule {
  id: string;
  scheduleType: 'RECURRING' | 'CUSTOM';
  sessionType: ScheduledOfferingType;
  billingType: ClassBillingType | null;
  frequencyWeeks: 1 | 2 | null;
  anchorDate: string | null;
  effectiveFrom: string;
  effectiveTo: string;
  rows: ClassScheduleRow[];
}
