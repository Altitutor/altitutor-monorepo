import type {
  ClassScheduleFormValues,
  ClassScheduleProposal,
  ClassScheduleRow,
} from '../types/schedule';

export function validateClassScheduleRows(rows: ClassScheduleRow[]): string | null {
  if (rows.length === 0) return 'Add at least one schedule row.';

  for (const row of rows) {
    if (row.dayOfWeek < 0 || row.dayOfWeek > 6 || !row.startTime || !row.endTime) {
      return 'Every schedule row needs a weekday, start time, and end time.';
    }
    if (row.endTime <= row.startTime) return 'Every end time must be after its start time.';
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    for (let otherIndex = index + 1; otherIndex < rows.length; otherIndex += 1) {
      const other = rows[otherIndex];
      if (
        row.dayOfWeek === other.dayOfWeek &&
        row.startTime < other.endTime &&
        other.startTime < row.endTime
      ) {
        return 'Schedule rows on the same day cannot overlap.';
      }
    }
  }

  return null;
}

export function buildClassScheduleProposal(
  values: ClassScheduleFormValues
): ClassScheduleProposal {
  return {
    class_id: values.classId,
    subject_id: values.subjectId,
    cohort_label: values.cohortLabel.trim(),
    status: 'ACTIVE',
    schedule_type: 'RECURRING',
    start_date: values.startDate,
    end_date: values.endDate,
    effective_from: values.startDate,
    timezone: 'Australia/Adelaide',
    frequency_weeks: values.frequencyWeeks,
    anchor_date: values.startDate,
    recurring_rows: values.rows.map((row, position) => ({
      id: row.id,
      day_of_week: row.dayOfWeek,
      start_time: row.startTime,
      end_time: row.endTime,
      room: row.room.trim() || null,
      position,
    })),
  };
}
