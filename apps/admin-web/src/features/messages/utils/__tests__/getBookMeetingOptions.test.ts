import { getBookMeetingOptions } from '../getBookMeetingOptions';

describe('getBookMeetingOptions', () => {
  it('offers trial, subsidy, and staff interview for an unlinked number', () => {
    expect(getBookMeetingOptions({ phone_e164: '+61400000000' })).toEqual([
      { kind: 'trial', label: 'Trial session', requiresPhoneOwner: true },
      { kind: 'subsidy', label: 'Subsidy interview', requiresPhoneOwner: true },
      { kind: 'staff-interview', label: 'Staff interview', requiresPhoneOwner: false },
    ]);
  });

  it('offers check in and drafting for a student', () => {
    expect(getBookMeetingOptions({ students: { id: 's-1', first_name: 'Ada' } })).toEqual([
      { kind: 'check-in', label: 'Check in', requiresPhoneOwner: false },
      { kind: 'drafting', label: 'Drafting session', requiresPhoneOwner: false },
    ]);
  });

  it('offers check in for a parent', () => {
    expect(getBookMeetingOptions({ parents: { id: 'p-1' } })).toEqual([
      { kind: 'check-in', label: 'Check in', requiresPhoneOwner: false },
    ]);
  });

  it('offers check in for staff and admin meeting for admin staff', () => {
    expect(getBookMeetingOptions({ staff: { id: 't-1', role: 'TUTOR' } })).toEqual([
      { kind: 'check-in', label: 'Check in', requiresPhoneOwner: false },
    ]);
    expect(getBookMeetingOptions({ staff: { id: 'a-1', role: 'ADMINSTAFF' } })).toEqual([
      { kind: 'check-in', label: 'Check in', requiresPhoneOwner: false },
      { kind: 'admin-meeting', label: 'Admin meeting', requiresPhoneOwner: false },
    ]);
  });

  it('offers nothing without a contact', () => {
    expect(getBookMeetingOptions(null)).toEqual([]);
  });
});
