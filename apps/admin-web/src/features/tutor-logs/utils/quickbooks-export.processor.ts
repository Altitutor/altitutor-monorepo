/**
 * QuickBooks Export Processor
 * 
 * Processes tutor logs data and handles overlapping sessions to generate QuickBooks CSV entries
 */

import type { Database } from '@altitutor/shared';
import {
  PAY_CATEGORIES,
  determinePayCategory,
  generateEmployeeExternalId,
  getSessionPriority,
  type PayCategory,
} from '../config/quickbooks-export.config';
import {
  formatDateAdelaide,
  formatTimeAdelaide,
  formatTime12HourAdelaide,
  calculateHours,
} from './quickbooks-export.utils';

type SessionType = Database['public']['Enums']['session_type'];
type StaffAttendanceType = 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR';

/**
 * Raw tutor log entry with all related data needed for export
 */
export type TutorLogExportData = {
  tutorLogId: string;
  sessionId: string;
  sessionType: SessionType;
  sessionStartAt: string;
  sessionEndAt: string;
  staffId: string;
  staffFirstName: string;
  staffLastName: string;
  staffAttendanceType: StaffAttendanceType | null;
  subjectName: string | null;
  subjectLongName: string | null;
  attendedStudentCount: number;
};

/**
 * Processed QuickBooks entry ready for CSV
 */
export type QuickBooksEntry = {
  date: string; // DD/MM/YYYY
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  employeeExternalId: string;
  payCategoryExternalId: PayCategory;
  comments: string;
  units: number; // decimal hours
  originalStartAt: string; // UTC timestamp (for overlap calculation)
  originalEndAt: string; // UTC timestamp (for overlap calculation)
  priority: number; // Session type priority
};

/**
 * Result of processing tutor logs
 */
export type ProcessTutorLogsResult = {
  entries: QuickBooksEntry[];
  excludedClasses: Array<{
    sessionId: string;
    sessionType: SessionType;
    sessionStartAt: string;
    subjectName: string | null;
  }>;
};

/**
 * Process tutor logs and generate QuickBooks entries
 * Handles overlapping sessions by reducing units of lower priority sessions
 * Groups entries by type: admin shifts, meetings, class sessions
 * Excludes class sessions with no students attended (Homework Help classes are always included)
 */
export function processTutorLogsForExport(
  tutorLogs: TutorLogExportData[]
): ProcessTutorLogsResult {
  const excludedClasses: Array<{
    sessionId: string;
    sessionType: SessionType;
    sessionStartAt: string;
    subjectName: string | null;
  }> = [];

  // Filter out class sessions with no students attended (except Homework Help)
  const filteredLogs = tutorLogs.filter((log) => {
    const isHomeworkHelp = log.subjectName === 'Homework Help';
    if (isClassType(log.sessionType) && log.attendedStudentCount === 0 && !isHomeworkHelp) {
      excludedClasses.push({
        sessionId: log.sessionId,
        sessionType: log.sessionType,
        sessionStartAt: log.sessionStartAt,
        subjectName: log.subjectName,
      });
      return false;
    }
    return true;
  });

  // Group entries by staff member
  const entriesByStaff = new Map<string, TutorLogExportData[]>();
  
  for (const log of filteredLogs) {
    if (!entriesByStaff.has(log.staffId)) {
      entriesByStaff.set(log.staffId, []);
    }
    entriesByStaff.get(log.staffId)!.push(log);
  }
  
  // Process each staff member's entries
  const allEntries: QuickBooksEntry[] = [];
  
  for (const [, logs] of entriesByStaff.entries()) {
    const staffEntries = processStaffEntries(logs);
    allEntries.push(...staffEntries);
  }
  
  // Sort: date asc, employee external id asc, start time asc
  const result = [...allEntries].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    const employeeCompare = a.employeeExternalId.localeCompare(b.employeeExternalId);
    if (employeeCompare !== 0) return employeeCompare;
    return a.startTime.localeCompare(b.startTime);
  });

  return {
    entries: result,
    excludedClasses,
  };
}

/**
 * Process entries for a single staff member
 * Handles overlapping sessions
 */
function processStaffEntries(logs: TutorLogExportData[]): QuickBooksEntry[] {
  // Convert to QuickBooks entries (without overlap adjustment)
  const entries = logs
    .map((log) => {
      const payCategory = determinePayCategory({
        sessionType: log.sessionType,
        subjectName: log.subjectName,
        staffAttendanceType: log.staffAttendanceType,
        attendedStudentCount: log.attendedStudentCount,
      });
      
      if (!payCategory) {
        // Skip entries without a valid pay category
        return null;
      }
      
      const basePriority = getSessionPriority(log.sessionType);
      // Homework Help should have lower priority than other classes
      // while still remaining above admin shifts.
      const priority =
        payCategory === PAY_CATEGORIES.HOMEWORK_HELP && basePriority > 0
          ? basePriority - 0.5
          : basePriority;

      const employeeExternalId = generateEmployeeExternalId(
        log.staffFirstName,
        log.staffLastName
      );
      
      const comments = generateComments(log);

      return {
        date: formatDateAdelaide(log.sessionStartAt),
        startTime: formatTimeAdelaide(log.sessionStartAt),
        endTime: formatTimeAdelaide(log.sessionEndAt),
        employeeExternalId,
        payCategoryExternalId: payCategory,
        comments,
        units: calculateHours(log.sessionStartAt, log.sessionEndAt),
        originalStartAt: log.sessionStartAt,
        originalEndAt: log.sessionEndAt,
        priority,
      };
    })
    .filter((e): e is QuickBooksEntry => e !== null);
  
  // Handle overlapping sessions
  return adjustOverlappingEntries(entries);
}

/**
 * Adjust entries for overlapping sessions
 * Reduces units of lower priority sessions when they overlap with higher priority ones
 * If two sessions of the same type overlap, keep the first one (by start time)
 */
function adjustOverlappingEntries(entries: QuickBooksEntry[]): QuickBooksEntry[] {
  // Sort by priority (descending), then by start time
  const sorted = [...entries].sort((a, b) => {
    const priorityDiff = b.priority - a.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.originalStartAt).getTime() - new Date(b.originalStartAt).getTime();
  });
  
  const adjusted: QuickBooksEntry[] = [];
  
  for (let i = 0; i < sorted.length; i++) {
    const current = { ...sorted[i] };
    let remainingUnits = current.units;
    
    // Check for overlaps with higher priority entries (already processed)
    for (const higherPriority of adjusted) {
      if (overlaps(current, higherPriority)) {
        const overlapHours = calculateOverlapHours(current, higherPriority);
        remainingUnits = Math.max(0, remainingUnits - overlapHours);
      }
    }
    
    // Check for overlaps with same priority entries (already processed)
    // If same priority overlaps, the first one (by start time) wins
    for (const samePriority of adjusted) {
      if (
        samePriority.priority === current.priority &&
        overlaps(current, samePriority)
      ) {
        const overlapHours = calculateOverlapHours(current, samePriority);
        remainingUnits = Math.max(0, remainingUnits - overlapHours);
      }
    }
    
    // Only add entry if it has remaining units
    if (remainingUnits > 0) {
      current.units = Math.round(remainingUnits * 100) / 100; // Round to 2 decimals
      // Preserve sessionGroup if it exists
      adjusted.push(current);
    }
  }
  
  return adjusted;
}

/**
 * Check if two time ranges overlap
 */
function overlaps(a: QuickBooksEntry, b: QuickBooksEntry): boolean {
  const aStart = new Date(a.originalStartAt).getTime();
  const aEnd = new Date(a.originalEndAt).getTime();
  const bStart = new Date(b.originalStartAt).getTime();
  const bEnd = new Date(b.originalEndAt).getTime();
  
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Calculate overlap hours between two entries
 */
function calculateOverlapHours(a: QuickBooksEntry, b: QuickBooksEntry): number {
  const aStart = new Date(a.originalStartAt).getTime();
  const aEnd = new Date(a.originalEndAt).getTime();
  const bStart = new Date(b.originalStartAt).getTime();
  const bEnd = new Date(b.originalEndAt).getTime();
  
  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);
  
  if (overlapStart >= overlapEnd) return 0;
  
  const overlapMs = overlapEnd - overlapStart;
  return Math.round((overlapMs / (1000 * 60 * 60)) * 100) / 100;
}

/**
 * Format session type for display
 * Converts enum values to readable format (e.g., SUBSIDY_INTERVIEW -> "Subsidy Interview")
 */
function formatSessionType(sessionType: SessionType): string {
  return sessionType
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Check if session type is a meeting type
 */
function isMeetingType(sessionType: SessionType): boolean {
  return ['TRIAL_SESSION', 'SUBSIDY_INTERVIEW', 'STAFF_INTERVIEW'].includes(sessionType);
}

/**
 * Check if session type is a class type
 */
function isClassType(sessionType: SessionType): boolean {
  return ['CLASS', 'DRAFTING', 'EXAM_COURSE'].includes(sessionType);
}

/**
 * Generate comments string for QuickBooks entry
 * Format: {subject.longname} {date dd/mm/yyyy} {start_time hh:mm p} - {end_time hh:mm p}
 * For ADMIN_SHIFT sessions, use "Admin Shift" instead of subject name
 * For meeting types (TRIAL_SESSION, SUBSIDY_INTERVIEW, STAFF_INTERVIEW), use formatted session type instead of subject
 */
function generateComments(log: TutorLogExportData): string {
  let subjectDisplay: string;
  
  if (isMeetingType(log.sessionType)) {
    // For meeting types, use formatted session type instead of subject
    subjectDisplay = formatSessionType(log.sessionType);
  } else if (log.sessionType === 'ADMIN_SHIFT') {
    subjectDisplay = 'Admin Shift';
  } else {
    subjectDisplay = log.subjectLongName || log.subjectName || 'Unknown Subject';
  }
  
  const date = formatDateAdelaide(log.sessionStartAt);
  const startTime = formatTime12HourAdelaide(log.sessionStartAt);
  const endTime = formatTime12HourAdelaide(log.sessionEndAt);
  
  return `${subjectDisplay} ${date} ${startTime} - ${endTime}`;
}
