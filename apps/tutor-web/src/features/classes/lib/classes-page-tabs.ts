export const CLASSES_PAGE_TABS = ['timetable', 'classes', 'tutor-logs'] as const;

export type ClassesPageTab = (typeof CLASSES_PAGE_TABS)[number];

export function parseClassesPageTab(value: string | null | undefined): ClassesPageTab {
  if (value && (CLASSES_PAGE_TABS as readonly string[]).includes(value)) {
    return value as ClassesPageTab;
  }
  return 'timetable';
}
