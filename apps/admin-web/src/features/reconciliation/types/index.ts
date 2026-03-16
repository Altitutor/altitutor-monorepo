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
  was_trial: boolean | null;
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
  actual_was_trial: boolean | null;
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
  subject_added_at: string | null;
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

// Failed Delivery Messages
export interface FailedDeliveryMessage {
  message_id: string;
  conversation_id: string;
  direction: string;
  body: string;
  status: string;
  status_updated_at: string | null;
  error_code: number | null;
  error_message: string | null;
  message_sid: string | null;
  from_number_e164: string | null;
  to_number_e164: string;
  created_at: string;
  updated_at: string | null;
  conversation_status: string;
  assigned_staff_id: string | null;
  conversation_last_message_at: string | null;
  contact_name: string | null;
  contact_phone: string;
  contact_type: string;
  student_id: string | null;
  parent_id: string | null;
  staff_id: string | null;
  hours_since_failure: number | null;
}

// Students Without Payment Method
export interface StudentWithoutPaymentMethod {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  student_status: string;
  stripe_customer_id: string | null;
  billing_created_at: string | null;
  created_at: string;
  updated_at: string;
}

// Trial Students Not Signed Up
export interface TrialStudentNotSignedUp {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  student_status: string;
  user_id: string | null;
  first_trial_session_date: string | null;
  first_trial_session_id: string | null;
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
  collection_method: 'charge_automatically' | 'send_invoice' | null;
  last_payment_error: {
    code: string;
    message: string;
    type: string;
  } | null;
  student_first_name: string | null;
  student_last_name: string | null;
  student_email: string | null;
  days_overdue: number | null;
}

// Reconciliation Category Types
export type ReconciliationCategory = 'financial' | 'scheduling' | 'communication';

// Unassigned Task (task with no assignee)
export interface UnassignedTask {
  id: string;
  title: string;
  status: string;
  priority: number | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  issue?: { id: string; name: string | null } | null;
  project?: { id: string; name: string | null } | null;
}

export type ReconciliationItemType =
  | 'uninvoiced_sessions'
  | 'unpaid_invoices'
  | 'unlogged_sessions'
  | 'unassigned_classes'
  | 'unassigned_tasks'
  | 'failed_delivery_messages'
  | 'students_without_classes'
  | 'students_without_payment_method'
  | 'trial_students_not_signed_up';

export interface ReconciliationCategoryData {
  category: ReconciliationCategory;
  items: {
    uninvoiced_sessions?: UninvoicedSession[];
    unpaid_invoices?: UnpaidInvoice[];
    unlogged_sessions?: UnloggedSession[];
    unassigned_classes?: UnassignedClass[];
    unassigned_tasks?: UnassignedTask[];
    failed_delivery_messages?: FailedDeliveryMessage[];
    students_without_classes?: StudentWithoutClasses[];
    students_without_payment_method?: StudentWithoutPaymentMethod[];
    trial_students_not_signed_up?: TrialStudentNotSignedUp[];
  };
  counts: {
    uninvoiced_sessions: number;
    unpaid_invoices: number;
    unlogged_sessions: number;
    unassigned_classes: number;
    unassigned_tasks: number;
    failed_delivery_messages: number;
    students_without_classes: number;
    students_without_payment_method: number;
    trial_students_not_signed_up: number;
  };
}
