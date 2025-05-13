import { useRepository } from './useRepository';
import { useClassesStaff } from './useClassesStaff';
import {
  studentRepository,
  staffRepository,
  classRepository,
  classesStudentsRepository,
  absenceRepository,
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
export const useStudents = () => useRepository(studentRepository);
export const useStaff = () => useRepository(staffRepository);
export const useClasses = () => useRepository(classRepository);
export const useClassesStudents = () => useRepository(classesStudentsRepository);
export { useClassesStaff };
export const useAbsences = () => useRepository(absenceRepository);
export const useSessions = () => useRepository(sessionRepository);
export const useSessionsStudents = () => useRepository(sessionsStudentsRepository);
export const useSessionsStaff = () => useRepository(sessionsStaffRepository);
export const useSubjects = () => useRepository(subjectRepository);
export const useStudentsSubjects = () => useRepository(studentsSubjectsRepository);
export const useStaffSubjects = () => useRepository(staffSubjectsRepository);
export const useTopics = () => useRepository(topicRepository);
export const useSubtopics = () => useRepository(subtopicRepository);
export const useResourceFiles = () => useRepository(resourceFileRepository);
export const useSessionsResourceFiles = () => useRepository(sessionsResourceFilesRepository);
export const useStudentAuditLogs = () => useRepository(studentAuditLogRepository);
export const useStaffAuditLogs = () => useRepository(staffAuditLogRepository);
export const useClassAuditLogs = () => useRepository(classAuditLogRepository);
export const useSessionAuditLogs = () => useRepository(sessionAuditLogRepository);

// Export repository hook for custom uses
export { useRepository }; 