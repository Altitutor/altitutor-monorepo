import type { ClassWithExpandedSubject } from '@altitutor/shared';

export function classFixture(overrides: Partial<ClassWithExpandedSubject> = {}): ClassWithExpandedSubject {
  return {
    id: 'active-class', subject_id: 'maths', status: 'ACTIVE',
    day_of_week: 1, start_time: '16:00:00', end_time: '17:00:00',
    billing_type: 'CLASS', billing_type_effective_from: '2026-01-01',
    cohort_label: null, created_at: null, created_by: null, updated_at: null,
    level: null, long_name: 'Maths Monday', short_name: 'Maths Mon', room: null,
    next_session_start_at: null, schedule_anchor_date: '2026-01-05',
    schedule_frequency_weeks: 1, schedule_projected_on: null, schedule_rows: [],
    schedule_summary_long: null, schedule_summary_short: null,
    schedule_timezone: 'Australia/Adelaide', schedule_weekdays: [1],
    session_start_date: '2026-01-01', session_end_date: '2026-12-31',
    session_type: 'CLASS',
    ...overrides,
  };
}
