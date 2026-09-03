import { parseSessionStudentList } from '../parseSessionDetailJson';
import { sessionStudentDisplayKind } from '../sessionStudentDisplay';

describe('parseSessionStudentList', () => {
  it('keeps is_extra from session detail JSON', () => {
    const students = parseSessionStudentList([
      {
        id: 'student-1',
        first_name: 'Bob',
        last_name: 'Lee',
        year_level: 12,
        planned_absence: false,
        session_student_id: 'ss-1',
        is_extra: true,
      },
      {
        id: 'student-2',
        first_name: 'Alice',
        last_name: 'Chen',
        year_level: 12,
        planned_absence: false,
        session_student_id: 'ss-2',
        is_extra: false,
      },
    ]);

    expect(students[0]?.is_extra).toBe(true);
    expect(students[1]?.is_extra).toBe(false);
  });
});

describe('sessionStudentDisplayKind', () => {
  it('marks extra students separately from regular attendees', () => {
    expect(sessionStudentDisplayKind({ is_extra: true, planned_absence: false })).toBe('extra');
    expect(sessionStudentDisplayKind({ is_extra: false, planned_absence: false })).toBe('attending');
  });

  it('keeps planned absences as absences even if the student is extra', () => {
    expect(sessionStudentDisplayKind({ is_extra: true, planned_absence: true })).toBe('absent');
  });
});
