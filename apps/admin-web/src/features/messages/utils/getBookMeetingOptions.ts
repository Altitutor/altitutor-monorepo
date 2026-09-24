export type BookMeetingKind =
  | 'trial'
  | 'subsidy'
  | 'staff-interview'
  | 'check-in'
  | 'drafting'
  | 'admin-meeting';

export type BookMeetingOption = {
  kind: BookMeetingKind;
  label: string;
  requiresPhoneOwner: boolean;
};

export type BookMeetingContact = {
  phone_e164?: string | null;
  students?: { id: string; first_name?: string | null; last_name?: string | null } | null;
  parents?: { id: string; first_name?: string | null; last_name?: string | null } | null;
  staff?: { id: string; first_name?: string | null; last_name?: string | null; role?: string | null } | null;
} | null | undefined;

export function getBookMeetingOptions(contact: BookMeetingContact): BookMeetingOption[] {
  if (!contact) return [];

  if (contact.students?.id) {
    return [
      { kind: 'check-in', label: 'Check in', requiresPhoneOwner: false },
      { kind: 'drafting', label: 'Drafting session', requiresPhoneOwner: false },
    ];
  }

  if (contact.parents?.id) {
    return [{ kind: 'check-in', label: 'Check in', requiresPhoneOwner: false }];
  }

  if (contact.staff?.id) {
    const options: BookMeetingOption[] = [
      { kind: 'check-in', label: 'Check in', requiresPhoneOwner: false },
    ];
    if (contact.staff.role === 'ADMINSTAFF') {
      options.push({ kind: 'admin-meeting', label: 'Admin meeting', requiresPhoneOwner: false });
    }
    return options;
  }

  return [
    { kind: 'trial', label: 'Trial session', requiresPhoneOwner: true },
    { kind: 'subsidy', label: 'Subsidy interview', requiresPhoneOwner: true },
    { kind: 'staff-interview', label: 'Staff interview', requiresPhoneOwner: false },
  ];
}
