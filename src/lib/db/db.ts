import Dexie, { Table } from 'dexie';
import { 
  Student, Staff, Class, ClassEnrollment, ClassAssignment,
  Absence, Meeting, DraftingSession, ShiftSwap,
  Message, File, StudentAuditLog, StaffAuditLog, ClassAuditLog,
  SyncState, SyncQueueItem, Session, SessionAttendance
} from './types';

// Define Dexie database with tables
class AltiTutorDatabase extends Dexie {
  // Define tables
  students!: Table<Student>;
  staff!: Table<Staff>;
  classes!: Table<Class>;
  classEnrollments!: Table<ClassEnrollment>;
  classAssignments!: Table<ClassAssignment>;
  absences!: Table<Absence>;
  meetings!: Table<Meeting>;
  draftingSessions!: Table<DraftingSession>;
  shiftSwaps!: Table<ShiftSwap>;
  sessions!: Table<Session>;
  sessionAttendances!: Table<SessionAttendance>;
  messages!: Table<Message>;
  files!: Table<File>;
  studentAuditLogs!: Table<StudentAuditLog>;
  staffAuditLogs!: Table<StaffAuditLog>;
  classAuditLogs!: Table<ClassAuditLog>;
  
  // Sync-related tables
  syncState!: Table<SyncState>;
  syncQueue!: Table<SyncQueueItem>;
  
  constructor() {
    super('AltiTutorDB');
    
    // Define the schema with version number
    this.version(1).stores({
      // Core entities
      students: 'id, firstName, lastName, email, status, createdAt, updatedAt, userId',
      staff: 'id, firstName, lastName, email, role, status, createdAt, updatedAt, userId',
      classes: 'id, subject, dayOfWeek, status, createdAt, updatedAt',
      
      // Relationships
      classEnrollments: 'id, studentId, classId, status, startDate, endDate, createdAt, updatedAt, [studentId+classId+startDate]',
      classAssignments: 'id, staffId, classId, startDate, endDate, isSubstitute, createdAt, updatedAt, [staffId+classId+startDate]',
      
      // Events
      absences: 'id, studentId, date, type, isRescheduled, createdAt, updatedAt',
      meetings: 'id, studentId, date, type, createdAt, updatedAt',
      draftingSessions: 'id, studentId, date, type, createdAt, updatedAt',
      shiftSwaps: 'id, assignmentId, substituteStaffId, date, createdAt, updatedAt',
      sessions: 'id, date, type, subject, classId, staffId, createdAt, updatedAt',
      sessionAttendances: 'id, sessionId, studentId, attended, createdAt, updatedAt, [sessionId+studentId]',
      
      // Communications
      messages: 'id, studentId, type, status, createdAt, updatedAt',
      files: 'id, studentId, filename, type, createdAt, updatedAt',
      
      // Audit logs
      studentAuditLogs: 'id, studentId, action, createdAt',
      staffAuditLogs: 'id, staffId, action, createdAt',
      classAuditLogs: 'id, classId, action, createdAt',
      
      // Sync tables
      syncState: 'id, entityType, lastSynced, isDirty',
      syncQueue: 'id, entityType, entityId, operation, status, createdAt, attempts'
    });
  }
}

// Create and export a database instance
export const db = new AltiTutorDatabase();

// Function to initialize/reset the database for testing
export async function resetDatabase() {
  await db.delete();
  window.location.reload();
}

// Function to check database connection
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    await db.open();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
} 