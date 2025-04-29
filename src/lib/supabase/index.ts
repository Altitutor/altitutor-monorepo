// Export client
export { supabaseServer, getSupabaseClient, useSupabaseClient } from './client';

// Export auth functionality
export {
  useAuthStore,
  getUserRole,
  isAdminStaff,
  isTutor,
  isStudent,
  isStaff,
  setUserRole,
  type User,
  type UserRole,
  type AuthState
} from './auth';

// Export API modules
export { authApi, studentsApi } from './api';

// Export repositories
export { adminRepository } from './db/admin';
export {
  studentRepository,
  staffRepository,
  classRepository,
  classesStudentsRepository,
  classesStaffRepository,
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
  sessionAuditLogRepository,
  repositories
} from './db/repositories';

// Export types
export {
  type BaseEntity,
  type Database,
  type Student,
  type Staff,
  type Subject,
  type Class,
  type ClassEnrollment,
  type ClassAssignment,
  // Enums
  StudentStatus,
  StaffRole,
  StaffStatus,
  ClassStatus,
  EnrollmentStatus
} from './db/types';

// Export repository base class
export { Repository } from './db/repository'; 