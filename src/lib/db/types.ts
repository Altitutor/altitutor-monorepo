/**
 * Database models and types for local storage
 */

// Enums
export enum StudentStatus {
  CURRENT = 'CURRENT',
  INACTIVE = 'INACTIVE',
  TRIAL = 'TRIAL',
  DISCONTINUED = 'DISCONTINUED',
}

export enum StaffRole {
  ADMIN = 'ADMIN',
  TUTOR = 'TUTOR',
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
  email?: string | null;
  phoneNumber?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
  status: StudentStatus;
  notes?: string | null;
  userId?: string | null; // Link to auth user
}

export interface Staff extends BaseEntity {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  role: StaffRole;
  status: StaffStatus;
  notes?: string | null;
  userId: string; // Link to auth user
}

export interface Class extends BaseEntity {
  subject: string;
  dayOfWeek: number; // 0-6 for Sunday-Saturday
  startTime: string;
  endTime: string;
  maxCapacity: number;
  status: ClassStatus;
  notes?: string | null;
}

// Relationship interfaces
export interface ClassEnrollment extends BaseEntity {
  startDate: string;
  endDate?: string | null;
  status: EnrollmentStatus;
  studentId: string;
  classId: string;
  
  // Loaded relations
  student?: Student;
  class?: Class;
}

export interface ClassAssignment extends BaseEntity {
  startDate: string;
  endDate?: string | null;
  isSubstitute: boolean;
  staffId: string;
  classId: string;
  
  // Loaded relations
  staff?: Staff;
  class?: Class;
}

// Event interfaces
export interface Absence extends BaseEntity {
  date: string;
  type: AbsenceType;
  reason?: string | null;
  isRescheduled: boolean;
  rescheduledDate?: string | null;
  studentId: string;
  
  // Loaded relations
  student?: Student;
}

export interface Meeting extends BaseEntity {
  date: string;
  type: MeetingType;
  notes?: string | null;
  outcome?: string | null;
  studentId: string;
  
  // Loaded relations
  student?: Student;
}

export interface DraftingSession extends BaseEntity {
  date: string;
  type: DraftingType;
  notes?: string | null;
  studentId: string;
  
  // Loaded relations
  student?: Student;
}

export interface ShiftSwap extends BaseEntity {
  date: string;
  reason?: string | null;
  assignmentId: string;
  substituteStaffId: string;
  
  // Loaded relations
  originalAssignment?: ClassAssignment;
  substituteStaff?: Staff;
}

export interface Session extends BaseEntity {
  date: string;
  type: SessionType;
  subject: string;
  classId?: string | null;
  staffId: string;
  teachingContent?: string | null;
  notes?: string | null;
  
  // Loaded relations
  class?: Class;
  staff?: Staff;
  students?: Student[]; // Students who attended
}

export interface SessionAttendance extends BaseEntity {
  sessionId: string;
  studentId: string;
  attended: boolean;
  notes?: string | null;
  
  // Loaded relations
  session?: Session;
  student?: Student;
}

// Communication interfaces
export interface Message extends BaseEntity {
  type: MessageType;
  content: string;
  status: MessageStatus;
  studentId: string;
  
  // Loaded relations
  student?: Student;
}

export interface File extends BaseEntity {
  filename: string;
  path: string;
  type: FileType;
  studentId: string;
  
  // Loaded relations
  student?: Student;
}

// Audit log interfaces
export interface StudentAuditLog extends BaseEntity {
  action: AuditAction;
  details: Record<string, any>;
  studentId: string;
  
  // Loaded relations
  student?: Student;
}

export interface StaffAuditLog extends BaseEntity {
  action: AuditAction;
  details: Record<string, any>;
  staffId: string;
  
  // Loaded relations
  staff?: Staff;
}

export interface ClassAuditLog extends BaseEntity {
  action: AuditAction;
  details: Record<string, any>;
  classId: string;
  
  // Loaded relations
  class?: Class;
}

// Sync state for tracking local vs server changes
export interface SyncState {
  id: string; // Entity ID
  entityType: string; // Entity type name
  lastSynced: string; // ISO timestamp
  isDirty: boolean; // Has local changes
  serverVersion?: string | null; // Server version (for conflict resolution)
}

// Sync queue item for tracking pending changes
export interface SyncQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data?: any; // For CREATE/UPDATE
  createdAt: string;
  attempts: number;
  lastAttempt?: string | null;
  error?: string | null;
  status: 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED';
  timestamp?: string; // Added for sync operations
  clientId?: string; // Added for device identification
} 