import { useRepository } from './useRepository';
import {
  studentRepository,
  staffRepository,
  classRepository,
  classEnrollmentRepository,
  classAssignmentRepository,
  absenceRepository,
  meetingRepository,
  draftingSessionRepository,
  shiftSwapRepository,
  messageRepository,
  fileRepository,
  studentAuditLogRepository,
  staffAuditLogRepository,
  classAuditLogRepository,
  sessionRepository,
  sessionAttendanceRepository
} from '../repositories';

// Export hooks for each entity type
export const useStudents = () => useRepository(studentRepository);
export const useStaff = () => useRepository(staffRepository);
export const useClasses = () => useRepository(classRepository);
export const useClassEnrollments = () => useRepository(classEnrollmentRepository);
export const useClassAssignments = () => useRepository(classAssignmentRepository);
export const useAbsences = () => useRepository(absenceRepository);
export const useMeetings = () => useRepository(meetingRepository);
export const useDraftingSessions = () => useRepository(draftingSessionRepository);
export const useShiftSwaps = () => useRepository(shiftSwapRepository);
export const useSessions = () => useRepository(sessionRepository);
export const useSessionAttendances = () => useRepository(sessionAttendanceRepository);
export const useMessages = () => useRepository(messageRepository);
export const useFiles = () => useRepository(fileRepository);
export const useStudentAuditLogs = () => useRepository(studentAuditLogRepository);
export const useStaffAuditLogs = () => useRepository(staffAuditLogRepository);
export const useClassAuditLogs = () => useRepository(classAuditLogRepository);

// Export repository hook for custom uses
export { useRepository }; 