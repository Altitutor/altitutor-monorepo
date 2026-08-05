import type {
  ProcessTutorLogsForExportOptions,
  TutorLogExportData,
} from './quickbooks-export.processor';

export function getEmptyClassSessionsMode(
  selectedFilters: string[]
): NonNullable<ProcessTutorLogsForExportOptions['emptyClassSessions']> {
  const showWithStudents = selectedFilters.includes('with_students');
  const showEmptyClassSessions = selectedFilters.includes('empty_class');

  if (showWithStudents && showEmptyClassSessions) return 'include_all';
  if (showEmptyClassSessions) return 'only_empty';
  return 'exclude';
}

export type TutorLogsExportTableFilters = {
  staffIds: string[];
  subjectIds: string[];
  classIds: string[];
  sessionTypes: string[];
};

/**
 * Client-side filters for QuickBooks export rows (staff / subject / class / session type).
 * Empty class sessions are handled separately in `processTutorLogsForExport`.
 */
export function applyTutorLogsExportTableFilters(
  logs: TutorLogExportData[],
  f: TutorLogsExportTableFilters
): TutorLogExportData[] {
  return logs.filter((log) => {
    if (f.staffIds.length > 0 && !f.staffIds.includes(log.staffId)) return false;
    if (f.sessionTypes.length > 0 && !f.sessionTypes.includes(log.sessionType)) return false;
    if (f.subjectIds.length > 0 && (!log.subjectId || !f.subjectIds.includes(log.subjectId))) {
      return false;
    }
    if (f.classIds.length > 0 && (!log.classId || !f.classIds.includes(log.classId))) {
      return false;
    }
    return true;
  });
}
