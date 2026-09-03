import { getEmptyClassSessionsMode } from '../quickbooks-export.client-filters';
import {
  processTutorLogsForExport,
  type TutorLogExportData,
} from '../quickbooks-export.processor';

function classLog(
  subjectName: string,
  sessionType: TutorLogExportData['sessionType'] = 'CLASS'
): TutorLogExportData {
  return {
    tutorLogId: `log-${subjectName}`,
    sessionId: `session-${subjectName}`,
    sessionType,
    sessionStartAt: '2026-07-11T01:30:00.000Z',
    sessionEndAt: '2026-07-11T03:00:00.000Z',
    classId: 'class-id',
    subjectId: 'subject-id',
    staffId: 'staff-id',
    staffFirstName: 'John',
    staffLastName: 'Tran',
    staffAttendanceType: 'MAIN_TUTOR',
    subjectName,
    subjectLongName: subjectName,
    attendedStudentCount: 0,
  };
}

describe('QuickBooks empty class-session filtering', () => {
  it('excludes empty classes when no attendance filter is selected', () => {
    expect(getEmptyClassSessionsMode([])).toBe('exclude');
  });

  it('keeps zero-attendance Homework Help while excluding empty Classes', () => {
    const result = processTutorLogsForExport(
      [classLog('PRESACE 9 Mathematics'), classLog('Homework Help', 'HOMEWORK_HELP')],
      { emptyClassSessions: getEmptyClassSessionsMode([]) }
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].payCategoryExternalId).toBe('Homework help');
    expect(result.excludedClasses).toHaveLength(1);
    expect(result.excludedClasses[0].subjectName).toBe('PRESACE 9 Mathematics');
  });
});
