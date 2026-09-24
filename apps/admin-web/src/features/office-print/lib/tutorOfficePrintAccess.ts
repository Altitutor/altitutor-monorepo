export type TutorOfficePrintAccess = 'off' | 'office_hours' | 'unrestricted';

export const TUTOR_OFFICE_PRINT_ACCESS_OPTIONS: ReadonlyArray<{
  value: TutorOfficePrintAccess;
  label: string;
  description: string;
}> = [
  {
    value: 'off',
    label: 'Off',
    description: 'Tutors cannot send files to the office printer.',
  },
  {
    value: 'office_hours',
    label: 'Office hours only',
    description: 'Tutors can print only while an admin shift is on.',
  },
  {
    value: 'unrestricted',
    label: 'Unrestricted',
    description: 'Tutors can print whenever the office printer is online, the same as admin-web.',
  },
];
