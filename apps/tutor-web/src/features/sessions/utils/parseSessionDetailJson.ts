import type { SessionParent, SessionStaff, SessionStudent } from './session-helpers';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null;
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function parseSwappedStaff(value: unknown): SessionStaff['swapped_staff'] {
  const record = asRecord(value);
  if (!record || record.id == null || record.first_name == null || record.last_name == null) {
    return null;
  }
  return {
    id: String(record.id),
    first_name: String(record.first_name),
    last_name: String(record.last_name),
  };
}

export function parseSessionStaffList(value: unknown): SessionStaff[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = asRecord(item);
    if (!record || record.id == null || record.first_name == null || record.last_name == null) {
      return { id: '', first_name: '', last_name: '', role: '' };
    }
    return {
      id: String(record.id),
      first_name: String(record.first_name),
      last_name: String(record.last_name),
      role: record.role != null ? String(record.role) : '',
      type: readString(record, 'type'),
      planned_absence: readBoolean(record, 'planned_absence'),
      is_swapped: readBoolean(record, 'is_swapped'),
      is_swapped_in: readBoolean(record, 'is_swapped_in'),
      swapped_staff: parseSwappedStaff(record.swapped_staff),
      subjects: Array.isArray(record.subjects)
        ? record.subjects.map((subject) => {
            const subjectRecord = asRecord(subject);
            if (!subjectRecord || subjectRecord.id == null || subjectRecord.name == null) {
              return { id: '', name: '' };
            }
            return { id: String(subjectRecord.id), name: String(subjectRecord.name) };
          })
        : undefined,
    };
  });
}

export function parseSessionStudentList(value: unknown): SessionStudent[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = asRecord(item);
    if (!record || record.id == null || record.first_name == null || record.last_name == null) {
      return { id: '', first_name: '', last_name: '', year_level: null, planned_absence: false };
    }
    const sessionStudentId =
      readString(record, 'session_student_id') ??
      (record.session_student_id != null ? String(record.session_student_id) : undefined);
    return {
      id: String(record.id),
      first_name: String(record.first_name),
      last_name: String(record.last_name),
      year_level: typeof record.year_level === 'number' ? record.year_level : null,
      account_class: record.account_class === 'internal_test' ? 'internal_test' : 'external',
      session_student_id: sessionStudentId,
      planned_absence: Boolean(record.planned_absence),
      is_rescheduled: readBoolean(record, 'is_rescheduled'),
      is_credited: readBoolean(record, 'is_credited'),
      is_extra: readBoolean(record, 'is_extra'),
    };
  });
}

export function parseSessionParentList(value: unknown): SessionParent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record || record.id == null) return [];
    return [
      {
        id: String(record.id),
        first_name: record.first_name == null ? null : String(record.first_name),
        last_name: record.last_name == null ? null : String(record.last_name),
      },
    ];
  });
}

export function readOptionalIso(row: object, key: string): string | null {
  if (!(key in row)) return null;
  const value = (row as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

export function parseClassStaffIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record || record.id == null) return [];
    return [String(record.id)];
  });
}

export function parseClassEnrolledStudentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record || record.id == null) return [];
    return [String(record.id)];
  });
}
