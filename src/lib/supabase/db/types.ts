/**
 * Database models and types for local storage
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Flexible Database interface for Supabase TypeScript integration
 * 
 * This uses a flexible structure that allows any table names while maintaining
 * type safety through our Repository pattern and domain models below.
 * 
 * Benefits of this approach:
 * - No need to maintain complex database schema types
 * - Works with our Repository pattern's automatic snake_case ↔ camelCase conversion
 * - Avoids TypeScript conflicts when adding/removing tables
 * - Keeps focus on domain models rather than database implementation details
 */
export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Enums
export enum StudentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TRIAL = 'TRIAL',
  DISCONTINUED = 'DISCONTINUED',
}

export enum StaffRole {
  ADMIN = 'ADMIN',
  TUTOR = 'TUTOR',
  ADMINSTAFF = 'ADMINSTAFF',
}

export enum StaffStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TRIAL = 'TRIAL',
}

export enum ClassStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  FULL = 'FULL',
}

export enum EnrollmentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DISCONTINUED = 'DISCONTINUED',
  TRIAL = 'TRIAL',
}

export enum AbsenceType {
  PLANNED = 'PLANNED',
  UNPLANNED = 'UNPLANNED',
}

export enum MeetingType {
  TRIAL_SESSION = 'TRIAL_SESSION',
  SUBSIDY_INTERVIEW = 'SUBSIDY_INTERVIEW',
  PARENT_MEETING = 'PARENT_MEETING',
  OTHER = 'OTHER',
}

export enum DraftingType {
  ENGLISH = 'ENGLISH',
  ASSIGNMENT = 'ASSIGNMENT',
}

export enum MessageType {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  INTERNAL_NOTE = 'INTERNAL_NOTE',
}

export enum MessageStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum FileType {
  DOCUMENT = 'DOCUMENT',
  IMAGE = 'IMAGE',
  OTHER = 'OTHER',
}

export enum SessionType {
  CLASS = 'CLASS',
  DRAFTING = 'DRAFTING',
  SUBSIDY_INTERVIEW = 'SUBSIDY_INTERVIEW',
  TRIAL_SESSION = 'TRIAL_SESSION',
  TRIAL_SHIFT = 'TRIAL_SHIFT',
  STAFF_INTERVIEW = 'STAFF_INTERVIEW',
}

export enum AuditAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  ENROLLMENT_CHANGED = 'ENROLLMENT_CHANGED',
  ASSIGNMENT_CHANGED = 'ASSIGNMENT_CHANGED',
  OTHER = 'OTHER',
}

export enum SubjectCurriculum {
  SACE = 'SACE',
  IB = 'IB',
  PRESACE = 'PRESACE',
  PRIMARY = 'PRIMARY',
  MEDICINE = 'MEDICINE',
}

export enum SubjectDiscipline {
  MATHEMATICS = 'MATHEMATICS',
  SCIENCE = 'SCIENCE',
  HUMANITIES = 'HUMANITIES',
  ENGLISH = 'ENGLISH',
  ART = 'ART',
  LANGUAGE = 'LANGUAGE',
  MEDICINE = 'MEDICINE',
}

// Added per migration - for resource_files table
export enum ResourceType {
  NOTES = 'NOTES',
  TEST = 'TEST',
  PRACTICE_QUESTIONS = 'PRACTICE_QUESTIONS',
  VIDEO = 'VIDEO',
  EXAM = 'EXAM',
  FLASHCARDS = 'FLASHCARDS',
  REVISION_SHEET = 'REVISION_SHEET',
  CHEAT_SHEET = 'CHEAT_SHEET',
}

// Added per migration - for resource_files table
export enum ResourceAnswers {
  BLANK = 'BLANK',
  ANSWERS = 'ANSWERS',
}

// Base entity interface with common fields
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Core entity interfaces
export interface Student extends BaseEntity {
  firstName: string;
  lastName: string;
  studentEmail?: string | null;
  studentPhone?: string | null;
  parentFirstName?: string | null;
  parentLastName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
  status: StudentStatus;
  notes?: string | null;
  userId?: string | null; // Link to auth user
  school?: string | null;
  curriculum?: string | null;
  yearLevel?: number | null;
  availabilityMonday?: boolean | null;
  availabilityTuesday?: boolean | null;
  availabilityWednesday?: boolean | null;
  availabilityThursday?: boolean | null;
  availabilityFriday?: boolean | null;
  availabilitySaturdayAm?: boolean | null;
  availabilitySaturdayPm?: boolean | null;
  availabilitySundayAm?: boolean | null;
  availabilitySundayPm?: boolean | null;
  createdBy?: string | null;
}

export interface Staff extends BaseEntity {
  firstName: string;
  lastName: string;
  email?: string | null;
  phoneNumber?: string | null;
  role: StaffRole;
  status: StaffStatus;
  notes?: string | null;
  userId?: string; // Link to auth user (optional)
  officeKeyNumber?: number | null;
  hasParkingRemote?: 'VIRTUAL' | 'PHYSICAL' | 'NONE' | null;
  availabilityMonday?: boolean;
  availabilityTuesday?: boolean;
  availabilityWednesday?: boolean;
  availabilityThursday?: boolean;
  availabilityFriday?: boolean;
  availabilitySaturdayAm?: boolean;
  availabilitySaturdayPm?: boolean;
  availabilitySundayAm?: boolean;
  availabilitySundayPm?: boolean;
}

export interface Subject extends BaseEntity {
  name: string;
  yearLevel?: number | null;
  curriculum?: SubjectCurriculum | null;
  discipline?: SubjectDiscipline | null;
  level?: string | null; // 'HL'/'SL' for IB, 'ADVANCED'/'STANDARD' for PRESACE
  color?: string | null; // Color code for visual representation in UI
}

export interface Class extends BaseEntity {
  level: string; // Renamed from 'subject' - represents the class level/name
  dayOfWeek: number; // Maps to day_of_week in database
  startTime: string; // Maps to start_time in database
  endTime: string; // Maps to end_time in database
  maxCapacity: number; // Maps to max_capacity in database
  status: ClassStatus;
  notes?: string | null;
  subjectId?: string | null; // Maps to subject_id in database
  room?: string | null;
  createdBy?: string | null; // Maps to created_by in database
}

// Relationship interfaces
export interface ClassEnrollment extends BaseEntity {
  startDate: string; // Maps to start_date in database
  endDate?: string | null; // Maps to end_date in database
  status: EnrollmentStatus;
  studentId: string; // Maps to student_id in database
  classId: string; // Maps to class_id in database
  createdBy?: string | null; // Maps to created_by in database
  
  // Loaded relations
  student?: Student;
  class?: Class;
}

export interface ClassAssignment extends BaseEntity {
  startDate: string; // Maps to start_date in database
  endDate?: string | null; // Maps to end_date in database
  isSubstitute: boolean; // Maps to is_substitute in database (deprecated, now using status)
  staffId: string; // Maps to staff_id in database
  classId: string; // Maps to class_id in database
  status?: string; // Added per migration: ACTIVE/INACTIVE
  createdBy?: string | null; // Maps to created_by in database
  
  // Loaded relations
  staff?: Staff;
  class?: Class;
}

export interface Absence extends BaseEntity {
  date: string;
  type: AbsenceType;
  reason?: string | null;
  isRescheduled: boolean; // Maps to is_rescheduled in database
  rescheduledDate?: string | null; // Maps to rescheduled_date in database (deprecated per migration)
  studentId: string; // Maps to student_id in database
  missedSessionId?: string | null; // Maps to missed_session_id in database
  rescheduledSessionId?: string | null; // Maps to rescheduled_session_id in database
  createdBy?: string | null; // Maps to created_by in database
  
  // Loaded relations
  student?: Student;
  missedSession?: Session;
  rescheduledSession?: Session;
}

export interface Meeting extends BaseEntity {
  date: string;
  type: MeetingType;
  notes?: string | null;
  outcome?: string | null;
  studentId: string; // Maps to student_id in database
  
  // Loaded relations
  student?: Student;
}

export interface DraftingSession extends BaseEntity {
  date: string;
  type: DraftingType;
  notes?: string | null;
  studentId: string; // Maps to student_id in database
  
  // Loaded relations
  student?: Student;
}

export interface ShiftSwap extends BaseEntity {
  date: string;
  reason?: string | null;
  assignmentId: string; // Maps to assignment_id in database
  substituteStaffId: string; // Maps to substitute_staff_id in database
  
  // Loaded relations
  originalAssignment?: ClassAssignment;
  substituteStaff?: Staff;
}

export interface Session extends BaseEntity {
  date: string;
  type: SessionType;
  subject: string;
  classId?: string | null; // Maps to class_id in database, links session to a class
  staffId?: string | null; // Maps to staff_id in database (deprecated per migration)
  teachingContent?: string | null; // Maps to teaching_content in database (deprecated per migration)
  notes?: string | null;
  subjectId?: string | null; // Maps to subject_id in database
  startTime?: string | null; // Maps to start_time in database
  endTime?: string | null; // Maps to end_time in database
  
  // Loaded relations
  class?: Class;
  staff?: Staff;
  students?: Student[]; // Students who attended
}

export interface SessionAttendance extends BaseEntity {
  sessionId: string; // Maps to session_id in database
  studentId: string; // Maps to student_id in database
  attended: boolean;
  notes?: string | null;
  
  // Loaded relations
  session?: Session;
  student?: Student;
}

export interface Message extends BaseEntity {
  type: MessageType;
  content: string;
  status: MessageStatus;
  studentId: string; // Maps to student_id in database
  
  // Loaded relations
  student?: Student;
}

export interface File extends BaseEntity {
  filename: string;
  path: string;
  type: FileType;
  studentId: string; // Maps to student_id in database
  
  // Loaded relations
  student?: Student;
}

export interface StudentAuditLog extends BaseEntity {
  action: AuditAction;
  details: Record<string, unknown>;
  studentId: string; // Maps to student_id in database
  
  // Loaded relations
  student?: Student;
}

export interface StaffAuditLog extends BaseEntity {
  action: AuditAction;
  details: Record<string, unknown>;
  staffId: string; // Maps to staff_id in database
  
  // Loaded relations
  staff?: Staff;
}

export interface ClassesAuditLog extends BaseEntity {
  action: AuditAction;
  details: Record<string, unknown>;
  classId: string; // Maps to class_id in database
  
  // Loaded relations
  class?: Class;
}

// Added interfaces for tables in migrations

export interface SessionsStaff extends BaseEntity {
  sessionId: string; // Maps to session_id in database
  staffId: string; // Maps to staff_id in database
  type: 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR';
  
  // Loaded relations
  session?: Session;
  staff?: Staff;
}

export interface StudentsSubjects extends BaseEntity {
  studentId: string; // Maps to student_id in database
  subjectId: string; // Maps to subject_id in database
  createdBy?: string | null; // Maps to created_by in database
  
  // Loaded relations
  student?: Student;
  subject?: Subject;
}

export interface StaffSubjects extends BaseEntity {
  staffId: string; // Maps to staff_id in database
  subjectId: string; // Maps to subject_id in database
  
  // Loaded relations
  staff?: Staff;
  subject?: Subject;
}

export interface ResourceFile extends BaseEntity {
  topicId?: string | null; // Maps to topic_id in database
  subtopicId?: string | null; // Maps to subtopic_id in database
  type: ResourceType;
  answers: ResourceAnswers;
  number?: number | null;
  fileUrl: string; // Maps to file_url in database
  
  // Loaded relations
  topic?: Topic;
  subtopic?: Subtopic;
}

export interface SessionsResourceFiles extends BaseEntity {
  sessionId: string; // Maps to session_id in database
  resourceFileId: string; // Maps to resource_file_id in database
  createdBy?: string | null; // Maps to created_by in database
  
  // Loaded relations
  session?: Session;
  resourceFile?: ResourceFile;
}

export interface SessionAuditLog extends BaseEntity {
  sessionId: string; // Maps to session_id in database
  action: AuditAction;
  details: Record<string, unknown>;
  
  // Loaded relations
  session?: Session;
}

export interface SyncState {
  id: string; // Entity ID
  entityType: string; // Entity type name
  lastSynced: string; // ISO timestamp
  isDirty: boolean; // Has local changes
  serverVersion?: string | null; // Server version (for conflict resolution)
}

export interface SyncQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data?: unknown; // For CREATE/UPDATE
  createdAt: string;
  attempts: number;
  lastAttempt?: string | null;
  error?: string | null;
  status: 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED';
  timestamp?: string; // Added for sync operations
  clientId?: string; // Added for device identification
}

// Properly expose these types for the subject detail interfaces
export interface Topic extends BaseEntity {
  subjectId: string; // Maps to subject_id in database
  name: string;
  number: number;
  area?: string | null;
  
  // Loaded relations
  subject?: Subject;
}

export interface Subtopic extends BaseEntity {
  topicId: string; // Maps to topic_id in database
  name: string;
  number: number;
  
  // Loaded relations
  topic?: Topic;
} 