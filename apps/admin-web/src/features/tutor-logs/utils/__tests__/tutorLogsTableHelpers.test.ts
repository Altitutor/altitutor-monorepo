/**
 * Tests for tutorLogsTableHelpers utility functions
 */

import {
  formatClassDisplayName,
  formatTimeRange,
  formatSessionDate,
  extractCreatedByStaffIds,
  filterTutorLogsByStaff,
  paginateTutorLogs,
} from '../tutorLogsTableHelpers';
import type { Tables } from '@altitutor/shared';

describe('tutorLogsTableHelpers', () => {
  describe('formatClassDisplayName', () => {
    const mockClasses: Record<string, Tables<'classes'>> = {
      'class-1': {
        id: 'class-1',
        subject_id: 'subject-1',
        level: '1',
        day_of_week: 1,
        start_time: '14:00:00',
        end_time: '16:00:00',
        status: 'ACTIVE',
        created_at: null,
        created_by: null,
        room: null,
        session_end_date: null,
        session_start_date: null,
        updated_at: null,
        short_name: null,
        long_name: null,
      },
    };

    const mockSubjects: Record<string, Tables<'subjects'>> = {
      'subject-1': {
        id: 'subject-1',
        name: 'Mathematics',
        curriculum: 'SACE',
        year_level: 12,
        short_name: 'MATH',
        long_name: 'SACE 12 Mathematics',
        discipline: 'MATHEMATICS',
        level: null,
        color: null,
        created_at: null,
        updated_at: null,
      },
    };

    it('should format class display name with all parts', () => {
      const result = formatClassDisplayName('class-1', mockClasses, mockSubjects);
      expect(result).toBe('SACE 12 Mathematics 1');
    });

    it('should return null when classId is null', () => {
      const result = formatClassDisplayName(null, mockClasses, mockSubjects);
      expect(result).toBeNull();
    });

    it('should return null when class is not found', () => {
      const result = formatClassDisplayName('class-999', mockClasses, mockSubjects);
      expect(result).toBeNull();
    });

    it('should handle missing subject', () => {
      const classesWithoutSubject = {
        'class-1': {
          ...mockClasses['class-1'],
          subject_id: null,
        },
      };
      const result = formatClassDisplayName('class-1', classesWithoutSubject, mockSubjects);
      expect(result).toBe('1');
    });

    it('should handle missing curriculum and year_level', () => {
      const subjectWithoutCurriculum = {
        'subject-1': {
          ...mockSubjects['subject-1'],
          curriculum: null,
          year_level: null,
        },
      };
      const result = formatClassDisplayName('class-1', mockClasses, subjectWithoutCurriculum);
      expect(result).toBe('Mathematics 1');
    });
  });

  describe('formatTimeRange', () => {
    it('should format time range correctly', () => {
      const start = '2024-01-01T10:00:00Z';
      const end = '2024-01-01T11:30:00Z';
      const result = formatTimeRange(start, end);
      expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)–\d{1,2}:\d{2}\s*(AM|PM)/);
    });

    it('should return "-" when both times are null', () => {
      const result = formatTimeRange(null, null);
      expect(result).toBe('-');
    });

    it('should return only start time when end is null', () => {
      const result = formatTimeRange('2024-01-01T10:00:00Z', null);
      expect(result).not.toBe('-');
      expect(result).not.toContain('–');
    });

    it('should return only end time when start is null', () => {
      const result = formatTimeRange(null, '2024-01-01T11:00:00Z');
      expect(result).not.toBe('-');
      expect(result).not.toContain('–');
    });
  });

  describe('formatSessionDate', () => {
    it('should format session date correctly', () => {
      const dateString = '2024-01-15T10:00:00Z';
      const result = formatSessionDate(dateString);
      expect(result).toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2024/);
    });

    it('should return "-" when dateString is null', () => {
      const result = formatSessionDate(null);
      expect(result).toBe('-');
    });

    it('should return "-" when dateString is undefined', () => {
      const result = formatSessionDate(undefined);
      expect(result).toBe('-');
    });

    it('should handle invalid date strings gracefully', () => {
      const result = formatSessionDate('invalid-date');
      expect(result).toBe('invalid-date');
    });
  });

  describe('extractCreatedByStaffIds', () => {
    it('should extract unique staff IDs from tutor logs', () => {
      const tutorLogs = [
        { created_by: 'staff-1' },
        { created_by: 'staff-2' },
        { created_by: 'staff-1' }, // Duplicate
        { created_by: null },
      ] as Array<{ created_by: string | null }>;

      const result = extractCreatedByStaffIds(tutorLogs);
      expect(result).toHaveLength(2);
      expect(result).toContain('staff-1');
      expect(result).toContain('staff-2');
    });

    it('should return empty array when no staff IDs', () => {
      const tutorLogs = [
        { created_by: null },
        { created_by: null },
      ] as Array<{ created_by: string | null }>;

      const result = extractCreatedByStaffIds(tutorLogs);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty input', () => {
      const result = extractCreatedByStaffIds([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('filterTutorLogsByStaff', () => {
    const tutorLogs = [
      { id: 'log-1', created_by: 'staff-1' },
      { id: 'log-2', created_by: 'staff-2' },
      { id: 'log-3', created_by: 'staff-3' },
    ] as Array<{ id: string; created_by: string | null }>;

    const staffAttendance: Record<string, Array<{ staff_id: string }>> = {
      'log-2': [{ staff_id: 'staff-4' }],
      'log-3': [{ staff_id: 'staff-1' }],
    };

    it('should return all logs when staffFilters length <= 1', () => {
      const result = filterTutorLogsByStaff(tutorLogs, [], staffAttendance);
      expect(result).toHaveLength(3);
    });

    it('should filter logs by created_by when multiple staff filters', () => {
      const result = filterTutorLogsByStaff(tutorLogs, ['staff-1', 'staff-2'], staffAttendance);
      // log-1: created_by staff-1 (matches)
      // log-2: created_by staff-2 (matches)
      // log-3: created_by staff-3, but staff-1 attended (matches because staff-1 is in filters)
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.id)).toContain('log-1');
      expect(result.map((r) => r.id)).toContain('log-2');
      expect(result.map((r) => r.id)).toContain('log-3');
    });

    it('should filter logs by staff attendance when multiple staff filters', () => {
      const result = filterTutorLogsByStaff(tutorLogs, ['staff-1', 'staff-4'], staffAttendance);
      expect(result).toHaveLength(3); // log-1 (created_by), log-2 (attendance), log-3 (attendance)
      expect(result.map((r) => r.id)).toContain('log-1');
      expect(result.map((r) => r.id)).toContain('log-2');
      expect(result.map((r) => r.id)).toContain('log-3');
    });

    it('should return empty array when no logs match filters', () => {
      // When staffFilters.length > 1, client-side filtering is applied
      // Use 2 filters to trigger client-side filtering
      const result = filterTutorLogsByStaff(tutorLogs, ['staff-999', 'staff-998'], staffAttendance);
      expect(result).toHaveLength(0);
    });

    it('should return all logs when single staff filter (server-side filtering)', () => {
      // When staffFilters.length <= 1, server-side filtering handles it
      const result = filterTutorLogsByStaff(tutorLogs, ['staff-999'], staffAttendance);
      expect(result).toHaveLength(3); // Returns all logs, server handles filtering
    });
  });

  describe('paginateTutorLogs', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it('should paginate items correctly', () => {
      const result = paginateTutorLogs(items, 1, 5);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle second page correctly', () => {
      const result = paginateTutorLogs(items, 2, 5);
      expect(result).toEqual([6, 7, 8, 9, 10]);
    });

    it('should handle page size larger than items', () => {
      const result = paginateTutorLogs(items, 1, 20);
      expect(result).toEqual(items);
    });

    it('should return empty array for empty input', () => {
      const result = paginateTutorLogs([], 1, 10);
      expect(result).toEqual([]);
    });

    it('should handle last page with fewer items', () => {
      const result = paginateTutorLogs(items, 3, 4);
      expect(result).toEqual([9, 10]);
    });
  });
});
