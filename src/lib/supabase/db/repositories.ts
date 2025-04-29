import { Repository } from './repository';
import { 
  Student, Staff, Class, 
  Absence, Session, 
  StudentAuditLog, StaffAuditLog, ClassAuditLog, Subject
} from './types';

// Define types for the new tables based on migration files
interface ClassesStudents {
  id: string;
  student_id: string;
  class_id: string;
  start_date: string;
  end_date?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'TRIAL';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface ClassesStaff {
  id: string;
  staff_id: string;
  class_id: string;
  start_date: string;
  end_date?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface SessionsStudents {
  id: string;
  session_id: string;
  student_id: string;
  attended: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface SessionsStaff {
  id: string;
  session_id: string;
  staff_id: string;
  type: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR';
  created_at: string;
  updated_at: string;
}

interface StudentsSubjects {
  id: string;
  student_id: string;
  subject_id: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface StaffSubjects {
  id: string;
  staff_id: string;
  subject_id: string;
  created_at: string;
  updated_at: string;
}

interface Topic {
  id: string;
  subject_id: string;
  name: string;
  number: number;
  created_at: string;
  updated_at: string;
}

interface Subtopic {
  id: string;
  topic_id: string;
  name: string;
  number: number;
  created_at: string;
  updated_at: string;
}

interface ResourceFile {
  id: string;
  topic_id?: string;
  subtopic_id?: string;
  type: string; // 'NOTES', 'TEST', 'PRACTICE_QUESTIONS', 'VIDEO', 'EXAM', 'FLASHCARDS', 'REVISION_SHEET', 'CHEAT_SHEET'
  answers: string; // 'BLANK', 'ANSWERS'
  number?: number;
  file_url: string;
  created_at: string;
  updated_at: string;
}

interface SessionsResourceFiles {
  id: string;
  session_id: string;
  resource_file_id: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface SessionAuditLog {
  id: string;
  session_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Create repositories for each entity
export const studentRepository = new Repository<Student>('students');
export const staffRepository = new Repository<Staff>('staff');
export const classRepository = new Repository<Class>('classes');
export const classesStudentsRepository = new Repository<ClassesStudents>('classes_students');
export const classesStaffRepository = new Repository<ClassesStaff>('classes_staff');
export const absenceRepository = new Repository<Absence>('absences');
export const sessionRepository = new Repository<Session>('sessions');
export const sessionsStudentsRepository = new Repository<SessionsStudents>('sessions_students');
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