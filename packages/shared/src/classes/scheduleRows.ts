import type { Json } from '../supabase/generated';

export interface ProjectedClassScheduleRow {
  schedule_row_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  position: number;
}

interface ClassWithProjectedSchedule {
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  schedule_rows?: Json | null;
}

function isProjectedRow(value: Json): value is {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  position: number;
} {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && typeof value.id === 'string'
    && typeof value.day_of_week === 'number'
    && typeof value.start_time === 'string'
    && typeof value.end_time === 'string'
    && (typeof value.room === 'string' || value.room === null)
    && typeof value.position === 'number';
}

export function getProjectedClassScheduleRows(value: Json | null | undefined): ProjectedClassScheduleRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isProjectedRow)
    .sort((left, right) => left.position - right.position)
    .map(({ id, ...row }) => ({ ...row, schedule_row_id: id }));
}

export function expandProjectedClassScheduleRows<T extends ClassWithProjectedSchedule>(
  classes: T[]
): Array<T & ProjectedClassScheduleRow> {
  return classes.flatMap((classItem) => {
    const projectedRows = getProjectedClassScheduleRows(classItem.schedule_rows);
    if (projectedRows.length > 0) {
      return projectedRows.map((row) => ({ ...classItem, ...row }));
    }
    if (classItem.day_of_week === null || classItem.start_time === null || classItem.end_time === null) {
      return [];
    }
    return [{
      ...classItem,
      schedule_row_id: 'legacy-primary-row',
      day_of_week: classItem.day_of_week,
      start_time: classItem.start_time,
      end_time: classItem.end_time,
      room: classItem.room,
      position: 0,
    }];
  });
}
