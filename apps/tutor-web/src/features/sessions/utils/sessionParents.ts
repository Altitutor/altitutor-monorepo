import type { SessionParent } from './session-helpers';

export type ParentAttendanceStatus = 'attended' | 'did-not-attend' | 'not-logged';

export type TutorLogParentAttendance = {
  parent_id: string;
  attended: boolean;
};

export type ProcessedParent = {
  parent: SessionParent;
  attendanceStatus: ParentAttendanceStatus;
};

/** Match admin ViewSessionModal: parents on every non-class session except admin meetings. */
export function sessionShowsParents(sessionType: string | null | undefined): boolean {
  return sessionType != null && sessionType !== 'CLASS' && sessionType !== 'ADMIN_MEETING';
}

export function processSessionParents(
  parents: SessionParent[],
  parentAttendance: TutorLogParentAttendance[],
  hasTutorLog: boolean
): ProcessedParent[] {
  const attendanceByParentId = new Map(parentAttendance.map((row) => [row.parent_id, row.attended]));

  return parents
    .filter((parent) => parent.id)
    .map((parent) => {
      if (!hasTutorLog) {
        return { parent, attendanceStatus: 'not-logged' as const };
      }
      const attended = attendanceByParentId.get(parent.id);
      if (attended === undefined) {
        return { parent, attendanceStatus: 'not-logged' as const };
      }
      return {
        parent,
        attendanceStatus: attended ? ('attended' as const) : ('did-not-attend' as const),
      };
    });
}
