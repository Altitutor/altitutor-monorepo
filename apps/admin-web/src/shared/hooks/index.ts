// Utility hooks
export { useDebounce } from './useDebounce';
export { useLocalStorage } from './useLocalStorage';
export { useMediaQuery } from './useMediaQuery';
export { useRepository } from './useRepository';

// Re-export all feature hooks
export { useStudents } from '@/features/students/hooks';
export { useStaff } from '@/features/staff/hooks';
export { useSessions } from '@/features/sessions/hooks';
export { useClasses, useClassesStudents, useClassesStaff } from '@/features/classes/hooks';
export { useSubjects } from '@/features/subjects/hooks';
export { useTopics } from '@/features/topics/hooks';

// Repository-based hooks for entities without dedicated features
import { useRepository } from './useRepository';
import {
  sessionsStudentsRepository,
  sessionsStaffRepository,
  studentsSubjectsRepository,
  staffSubjectsRepository,
  subtopicRepository,
  resourceFileRepository,
  sessionsResourceFilesRepository,
  studentAuditLogRepository,
  staffAuditLogRepository,
  classAuditLogRepository,
  sessionAuditLogRepository
} from '@/shared/lib/supabase/database/repositories';

export const useSessionsStudents = () => useRepository(sessionsStudentsRepository);
export const useSessionsStaff = () => useRepository(sessionsStaffRepository);
export const useStudentsSubjects = () => useRepository(studentsSubjectsRepository);
export const useStaffSubjects = () => useRepository(staffSubjectsRepository);
export const useSubtopics = () => useRepository(subtopicRepository);
export const useResourceFiles = () => useRepository(resourceFileRepository);
export const useSessionsResourceFiles = () => useRepository(sessionsResourceFilesRepository);
export const useStudentAuditLogs = () => useRepository(studentAuditLogRepository);
export const useStaffAuditLogs = () => useRepository(staffAuditLogRepository);
export const useClassAuditLogs = () => useRepository(classAuditLogRepository);
export const useSessionAuditLogs = () => useRepository(sessionAuditLogRepository); 