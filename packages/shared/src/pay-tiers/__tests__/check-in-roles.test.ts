import {
  CHECK_IN_HOST,
  CHECK_IN_RECEIVER,
  checkInStaffingError,
  defaultCheckInSessionsStaffType,
  defaultCheckInStaffUiRole,
  filterSessionsStaffMayLog,
  staffMaySubmitTutorLog,
} from '../check-in-roles';

describe('defaultCheckInStaffUiRole', () => {
  it('defaults all staff to conducting when students or parents are on the check-in', () => {
    expect(defaultCheckInStaffUiRole(true)).toBe('host');
    expect(defaultCheckInSessionsStaffType(true)).toBe(CHECK_IN_HOST);
  });

  it('defaults staff to receiving on a staff-only check-in', () => {
    expect(defaultCheckInStaffUiRole(false)).toBe('receiver');
    expect(defaultCheckInSessionsStaffType(false)).toBe(CHECK_IN_RECEIVER);
  });
});

describe('checkInStaffingError', () => {
  it('requires conducting staff on every check-in', () => {
    expect(
      checkInStaffingError({ hostCount: 0, receiverCount: 1, hasStudentsOrParents: false })
    ).toBe('At least one conducting staff member is required for a check-in');
    expect(
      checkInStaffingError({ hostCount: 0, receiverCount: 0, hasStudentsOrParents: true })
    ).toBe('At least one conducting staff member is required for a check-in');
  });

  it('requires a receiving staff member only on staff-only check-ins', () => {
    expect(
      checkInStaffingError({ hostCount: 1, receiverCount: 0, hasStudentsOrParents: false })
    ).toBe('At least one receiving staff member is required for a staff check-in');
    expect(
      checkInStaffingError({ hostCount: 1, receiverCount: 0, hasStudentsOrParents: true })
    ).toBeNull();
  });

  it('accepts a staff check-in with both conducting and receiving roles', () => {
    expect(
      checkInStaffingError({ hostCount: 1, receiverCount: 1, hasStudentsOrParents: false })
    ).toBeNull();
  });
});

describe('staffMaySubmitTutorLog', () => {
  it('lets any assigned staff log non-check-in sessions', () => {
    expect(staffMaySubmitTutorLog('CLASS', 'MAIN_TUTOR')).toBe(true);
    expect(staffMaySubmitTutorLog('ADMIN_MEETING', 'SECONDARY_TUTOR')).toBe(true);
  });

  it('lets only conducting staff log a check-in', () => {
    expect(staffMaySubmitTutorLog('CHECK_IN', CHECK_IN_HOST)).toBe(true);
    expect(staffMaySubmitTutorLog('CHECK_IN', 'SECONDARY_TUTOR')).toBe(true);
    expect(staffMaySubmitTutorLog('CHECK_IN', CHECK_IN_RECEIVER)).toBe(false);
    expect(staffMaySubmitTutorLog('CHECK_IN', 'MAIN_TUTOR')).toBe(false);
    expect(staffMaySubmitTutorLog('CHECK_IN', null)).toBe(false);
  });
});

describe('filterSessionsStaffMayLog', () => {
  it('keeps class sessions and drops check-ins the staff member is only receiving', () => {
    const sessions = [
      { id: 'class-1', type: 'CLASS' as const },
      { id: 'check-in-host', type: 'CHECK_IN' as const },
      { id: 'check-in-receiver', type: 'CHECK_IN' as const },
    ];

    expect(
      filterSessionsStaffMayLog(sessions, {
        'class-1': 'MAIN_TUTOR',
        'check-in-host': CHECK_IN_HOST,
        'check-in-receiver': CHECK_IN_RECEIVER,
      }).map((s) => s.id)
    ).toEqual(['class-1', 'check-in-host']);
  });

  it('drops check-ins when the staff assignment is unknown', () => {
    expect(
      filterSessionsStaffMayLog([{ id: 'check-in', type: 'CHECK_IN' }], {}).map((s) => s.id)
    ).toEqual([]);
  });
});
