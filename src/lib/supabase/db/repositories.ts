import { Repository } from './repository';
import { 
  Student, Staff, Class, 
  Absence, Session, 
  StudentAuditLog, StaffAuditLog, ClassAuditLog, Subject,
  ClassEnrollment, ClassAssignment, SessionAttendance, Topic, Subtopic,
  SessionsStaff, StudentsSubjects, StaffSubjects,
  ResourceFile, SessionsResourceFiles, SessionAuditLog
} from './types';

// Create repositories for each entity
export const studentRepository = new Repository<Student>('students');
export const staffRepository = new Repository<Staff>('staff');
export const classRepository = new Repository<Class>('classes');
export const classesStudentsRepository = new Repository<ClassEnrollment>('classes_students');
export const classesStaffRepository = new Repository<ClassAssignment>('classes_staff');
export const absenceRepository = new Repository<Absence>('absences');
export const sessionRepository = new Repository<Session>('sessions');
export const sessionsStudentsRepository = new Repository<SessionAttendance>('sessions_students');
export const sessionsStaffRepository = new Repository<SessionsStaff>('sessions_staff');
export const subjectRepository = new Repository<Subject>('subjects');
export const studentsSubjectsRepository = new Repository<StudentsSubjects>('students_subjects');
export const staffSubjectsRepository = new Repository<StaffSubjects>('staff_subjects');
export const topicRepository = new Repository<Topic>('topics');
export const subtopicRepository = new Repository<Subtopic>('subtopics');
export const resourceFileRepository = new Repository<ResourceFile>('resource_files');
export const sessionsResourceFilesRepository = new Repository<SessionsResourceFiles>('sessions_resource_files');
export const studentAuditLogRepository = new Repository<StudentAuditLog>('student_audit_logs');
export const staffAuditLogRepository = new Repository<StaffAuditLog>('staff_audit_logs');
export const classAuditLogRepository = new Repository<ClassAuditLog>('class_audit_logs');
export const sessionAuditLogRepository = new Repository<SessionAuditLog>('session_audit_logs');

// Export all repositories
export const repositories = {
  students: studentRepository,
  staff: staffRepository,
  classes: classRepository,
  classesStudents: classesStudentsRepository,
  classesStaff: classesStaffRepository,
  absences: absenceRepository,
  sessions: sessionRepository,
  sessionsStudents: sessionsStudentsRepository,
  sessionsStaff: sessionsStaffRepository,
  subjects: subjectRepository,
  studentsSubjects: studentsSubjectsRepository,
  staffSubjects: staffSubjectsRepository,
  topics: topicRepository,
  subtopics: subtopicRepository,
  resourceFiles: resourceFileRepository,
  sessionsResourceFiles: sessionsResourceFilesRepository,
  studentAuditLogs: studentAuditLogRepository,
  staffAuditLogs: staffAuditLogRepository,
  classAuditLogs: classAuditLogRepository,
  sessionAuditLogs: sessionAuditLogRepository
}; 