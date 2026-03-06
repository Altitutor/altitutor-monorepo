import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';

export type EnrollmentContext = 'class' | 'student';

export interface EnrollmentConflicts {
  sameSubjectWarning: string | null;
  timeOverlapWarnings: string[];
}

export interface EnrollmentFilters {
  searchQuery: string;
  yearLevelFilters: number[];
  subjectFilters: string[];
  dayFilters: number[];
}

export interface EnrollmentFlowState {
  step: 1 | 2 | 3;
  selectedStudentId: string | null;
  selectedClassId: string | null;
  enrollmentDate: string;
  filters: EnrollmentFilters;
  conflicts: EnrollmentConflicts;
  isEnrolling: boolean;
}

export type StudentWithEnrollmentInfo = Tables<'students'> & {
  subjects?: Tables<'subjects'>[];
  isAlreadyEnrolled?: boolean;
  existingClassSubject?: Tables<'subjects'>;
};

export interface EnrollStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: EnrollmentContext;
  
  // When context is 'class'
  classData?: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  enrolledStudentIds?: string[];
  
  // When context is 'student'
  student?: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  enrolledClassIds?: string[];
  subjectId?: string; // Optional subject ID to filter classes
  
  // Data fetching
  onFetchStudents?: () => Promise<StudentWithEnrollmentInfo[]>;
  onFetchClasses?: () => Promise<ClassWithExpandedSubject[]>;
  
  // Enrollment handler
  onEnroll: (params: {
    studentId: string;
    classId: string;
    enrolledAt: Date;
    staffId: string;
  }) => Promise<void>;
  
  currentStaffId: string;
}

export interface EnrollmentWarningState {
  showEnrolledWarning: boolean;
  warningStudent: { student: Tables<'students'>; subject: Tables<'subjects'> } | null;
}

// Change Class Modal Types
export interface ChangeClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Current enrollment details
  student: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  oldClass: Tables<'classes'>;
  oldClassSubject?: Tables<'subjects'>;
  oldClassStaff?: Tables<'staff'>[];
  
  // Available classes to switch to (optional - uses RPC if not provided)
  onFetchClasses?: () => Promise<ClassWithExpandedSubject[]>;
  
  // Change class handler
  onChange: (params: {
    studentId: string;
    oldClassId: string;
    newClassId: string;
    changeoverDate: Date;
    staffId: string;
  }) => Promise<void>;
  
  currentStaffId: string;
}

// Unenroll Student Modal Types
export interface UnenrollStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Enrollment details
  student: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  class: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  
  // Unenrollment handler
  onUnenroll: (params: {
    studentId: string;
    classId: string;
    unenrolledAt: Date;
    reason: import('@tiptap/core').JSONContent;
    staffId: string;
  }) => Promise<void>;
  
  currentStaffId: string;
}

// Assign Staff Modal Types
export type AssignStaffContext = 'staff' | 'class';

export interface StaffConflictInfo {
  conflictingClass: {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    subject?: Tables<'subjects'> | null;
  };
}

export interface ClassConflictInfo {
  conflictingStaff: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export interface StaffUnavailabilityInfo {
  staffName: string;
  dayOfWeek: number;
}

export interface AssignStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: AssignStaffContext;
  
  // When context is 'staff'
  staff?: Tables<'staff'>;
  staffSubjects?: Tables<'subjects'>[];
  assignedClassIds?: string[];
  
  // When context is 'class'
  classData?: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  assignedStaffIds?: string[];
  
  // Assignment handler
  onAssign: (params: {
    staffId: string;
    classId: string;
    assignedAt: Date;
    currentStaffId: string;
  }) => Promise<void>;
  
  currentStaffId: string;
}

