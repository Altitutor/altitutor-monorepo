import {
  isTutorOfficePrintAllowed,
  isTutorOfficePrintVisible,
} from '../tutorOfficePrintAccess';

describe('isTutorOfficePrintAllowed', () => {
  it('blocks tutors when access is off, even during an admin shift', () => {
    expect(isTutorOfficePrintAllowed('off', true)).toBe(false);
    expect(isTutorOfficePrintAllowed('off', false)).toBe(false);
  });

  it('allows tutors during an admin shift only when access is office hours', () => {
    expect(isTutorOfficePrintAllowed('office_hours', true)).toBe(true);
    expect(isTutorOfficePrintAllowed('office_hours', false)).toBe(false);
  });

  it('allows tutors whenever access is unrestricted', () => {
    expect(isTutorOfficePrintAllowed('unrestricted', false)).toBe(true);
    expect(isTutorOfficePrintAllowed('unrestricted', true)).toBe(true);
  });
});

describe('isTutorOfficePrintVisible', () => {
  it('hides print actions only when access is off', () => {
    expect(isTutorOfficePrintVisible('off')).toBe(false);
    expect(isTutorOfficePrintVisible('office_hours')).toBe(true);
    expect(isTutorOfficePrintVisible('unrestricted')).toBe(true);
    expect(isTutorOfficePrintVisible(null)).toBe(true);
  });
});
