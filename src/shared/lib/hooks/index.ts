import { useRepository } from '@/shared/hooks';
import {
  studentRepository,
  staffRepository,
  classRepository,
  classesStudentsRepository,
  classesStaffRepository,
  sessionRepository,
  sessionsStudentsRepository,
  sessionsStaffRepository,
  subjectRepository,
  studentsSubjectsRepository,
  staffSubjectsRepository,
  topicRepository,
  subtopicRepository,
  resourceFileRepository,
  sessionsResourceFilesRepository,
  studentAuditLogRepository,
  staffAuditLogRepository,
  classAuditLogRepository,
  sessionAuditLogRepository
} from '../supabase/db/repositories';

// Export hooks for each entity type
export { useStudents } from '@/features/students/hooks';
export { useStaff } from '@/features/staff/hooks';
export { useSessions } from '@/features/sessions/hooks';
export { useClasses, useClassesStudents, useClassesStaff } from '@/features/classes/hooks';
export const useSessionsStudents = () => useRepository(sessionsStudentsRepository);
export const useSessionsStaff = () => useRepository(sessionsStaffRepository);
export { useSubjects } from '@/features/subjects/hooks';
export const useStudentsSubjects = () => useRepository(studentsSubjectsRepository);
export const useStaffSubjects = () => useRepository(staffSubjectsRepository);
export { useTopics } from '@/features/topics/hooks';
export const useSubtopics = () => useRepository(subtopicRepository);
export const useResourceFiles = () => useRepository(resourceFileRepository);
export const useSessionsResourceFiles = () => useRepository(sessionsResourceFilesRepository);
export const useStudentAuditLogs = () => useRepository(studentAuditLogRepository);
export const useStaffAuditLogs = () => useRepository(staffAuditLogRepository);
export const useClassAuditLogs = () => useRepository(classAuditLogRepository);
export const useSessionAuditLogs = () => useRepository(sessionAuditLogRepository); 