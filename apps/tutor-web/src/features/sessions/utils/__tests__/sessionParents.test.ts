import { parseTutorLogParentAttendance } from '../parseSessionDetailJson';
import { processSessionParents, sessionShowsParents } from '../sessionParents';
import type { SessionParent } from '../session-helpers';

const parent: SessionParent = { id: 'p1', first_name: 'Pat', last_name: 'Parent' };

describe('sessionShowsParents', () => {
  it('shows parents on check-ins and trials like admin view session modal', () => {
    expect(sessionShowsParents('CHECK_IN')).toBe(true);
    expect(sessionShowsParents('TRIAL_SESSION')).toBe(true);
  });

  it('hides parents on class and admin meetings', () => {
    expect(sessionShowsParents('CLASS')).toBe(false);
    expect(sessionShowsParents('ADMIN_MEETING')).toBe(false);
    expect(sessionShowsParents(null)).toBe(false);
  });
});

describe('processSessionParents', () => {
  it('marks attendance from the tutor log', () => {
    expect(
      processSessionParents([parent], [{ parent_id: 'p1', attended: true }], true)
    ).toEqual([{ parent, attendanceStatus: 'attended' }]);
  });

  it('stays not-logged when the session has no tutor log', () => {
    expect(processSessionParents([parent], [{ parent_id: 'p1', attended: true }], false)).toEqual([
      { parent, attendanceStatus: 'not-logged' },
    ]);
  });
});

describe('parseTutorLogParentAttendance', () => {
  it('reads parent_id and attended from the tutor log view JSON', () => {
    expect(
      parseTutorLogParentAttendance([{ parent_id: 'p1', attended: true, first_name: 'Pat' }])
    ).toEqual([{ parent_id: 'p1', attended: true }]);
  });
});
