import { Repository } from '../repository';
import { db } from '../db';
import { 
  Student, Staff, Class, ClassEnrollment, ClassAssignment,
  Absence, Meeting, DraftingSession, ShiftSwap,
  Message, File, Session, SessionAttendance,
  StudentAuditLog, StaffAuditLog, ClassAuditLog
} from '../types';

// Create repositories for each entity
export const studentRepository = new Repository<Student>('students');
export const staffRepository = new Repository<Staff>('staff');
export const classRepository = new Repository<Class>('classes');
export const classEnrollmentRepository = new Repository<ClassEnrollment>('class_enrollments');
export const classAssignmentRepository = new Repository<ClassAssignment>('class_assignments');
export const absenceRepository = new Repository<Absence>('absences');
export const meetingRepository = new Repository<Meeting>('meetings');
export const draftingSessionRepository = new Repository<DraftingSession>('drafting_sessions');
export const shiftSwapRepository = new Repository<ShiftSwap>('shift_swaps');
export const sessionRepository = new Repository<Session>('sessions');
export const sessionAttendanceRepository = new Repository<SessionAttendance>('session_attendances');
export const messageRepository = new Repository<Message>('messages');
export const fileRepository = new Repository<File>('files');
export const studentAuditLogRepository = new Repository<StudentAuditLog>('student_audit_logs');
export const staffAuditLogRepository = new Repository<StaffAuditLog>('staff_audit_logs');
export const classAuditLogRepository = new Repository<ClassAuditLog>('class_audit_logs');

// Export all repositories
export const repositories = {
  students: studentRepository,
  staff: staffRepository,
  classes: classRepository,
  classEnrollments: classEnrollmentRepository,
  classAssignments: classAssignmentRepository,
  absences: absenceRepository,
  meetings: meetingRepository,
  draftingSessions: draftingSessionRepository,
  shiftSwaps: shiftSwapRepository,
  sessions: sessionRepository,
  sessionAttendances: sessionAttendanceRepository,
  messages: messageRepository,
  files: fileRepository,
  studentAuditLogs: studentAuditLogRepository,
  staffAuditLogs: staffAuditLogRepository,
  classAuditLogs: classAuditLogRepository,
}; 