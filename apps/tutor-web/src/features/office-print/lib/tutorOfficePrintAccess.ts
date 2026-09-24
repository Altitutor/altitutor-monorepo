export type TutorOfficePrintAccess = 'off' | 'office_hours' | 'unrestricted';

export function isTutorOfficePrintAllowed(
  access: TutorOfficePrintAccess,
  windowOpen: boolean,
): boolean {
  if (access === 'off') return false;
  if (access === 'unrestricted') return true;
  return windowOpen;
}

export function isTutorOfficePrintVisible(access: TutorOfficePrintAccess | null): boolean {
  return access !== 'off';
}
