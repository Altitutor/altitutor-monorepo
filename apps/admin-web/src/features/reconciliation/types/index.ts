/**
 * TypeScript types for reconciliation data
 */

// Uninvoiced Sessions
export interface UninvoicedSession {
  sessions_students_id: string;
  student_id: string;
  session_id: string;
  planned_absence: boolean;
  is_rescheduled: boolean;
  is_credited: boolean;
  session_start_at: string;
  session_end_at: string | null;
  session_type: string;
  billing_type: string | null;
  subject_id: string | null;
  subject_name: string | null;
  subject_long_name: string | null;
  session_name: string;
  is_extra: boolean;
  has_tutor_log: boolean;
  actual_attended: boolean | null;
  student_first_name: string | null;
  student_last_name: string | null;
  student_email: string | null;
  student_phone: string | null;
  created_at: string;
  updated_at: string;
}


// Students Without Classes (one row per student-subject combination)
export interface StudentWithoutClasses {
  student_id: string;
  first_name: string;
  last_name: string;
  subject_id: string;
  subject_name: string;
  subject_curriculum: string | null;
  subject_year_level: number | null;
  created_at: string;
  updated_at: string;
}

// Unlogged Sessions
export interface UnloggedSession {
  session_id: string;
  start_at: string;
  end_at: string | null;
  session_type: string;
  subject_id: string | null;
  subject_name: string | null;
  class_id: string | null;
  day_of_week: number | null;
  class_start_time: string | null;
  class_end_time: string | null;
  assigned_tutors: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    type: string;
  }> | null;
  student_count: number;
  created_at: string;
  updated_at: string;
}

// Classes without staff
export interface UnassignedClass {
  class_id: string;
  subject_id: string | null;
  subject_name: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  class_status: string;
  room: string | null;
  level: string | null;
  student_count: number;
  created_at: string;
  updated_at: string;
}

// Unread Messages
export interface UnreadMessage {
  conversation_id: string;
  contact_id: string;
  conversation_status: string;
  last_message_id: string | null;
  last_message_at: string | null;
  assigned_staff_id: string | null;
  contact_name: string | null;
  contact_phone: string;
  contact_type: string;
  student_id: string | null;
  parent_id: string | null;
  staff_id: string | null;
  last_message_id_detail: string | null;
  last_message_direction: string | null;
  last_message_preview: string | null;
  last_message_created_at: string | null;
  unread_count: number;
  hours_since_last_message: number | null;
  created_at: string;
  updated_at: string;
}

// Unpaid Invoices (from invoices table directly)
export interface UnpaidInvoice {
  id: string;
  student_id: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  amount_due_cents: number;
  currency: string;
  stripe_invoice_id: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
  student_email: string | null;
  days_overdue: number | null;
}

// Reconciliation Category Types
export type ReconciliationCategory = 'financial' | 'scheduling' | 'communication';

export type ReconciliationItemType =
  | 'uninvoiced_sessions'
  | 'unpaid_invoices'
  | 'unlogged_sessions'
  | 'unassigned_classes'
  | 'unread_messages'
  | 'students_without_classes';

export interface ReconciliationCategoryData {
  category: ReconciliationCategory;
  items: {
    uninvoiced_sessions?: UninvoicedSession[];
    unpaid_invoices?: UnpaidInvoice[];
    unlogged_sessions?: UnloggedSession[];
    unassigned_classes?: UnassignedClass[];
    unread_messages?: UnreadMessage[];
    students_without_classes?: StudentWithoutClasses[];
  };
  counts: {
    uninvoiced_sessions: number;
    unpaid_invoices: number;
    unlogged_sessions: number;
    unassigned_classes: number;
    unread_messages: number;
    students_without_classes: number;
  };
}
