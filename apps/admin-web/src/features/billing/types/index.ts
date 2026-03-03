import type { Tables } from '@altitutor/shared';

/**
 * Invoice row type
 */
export type InvoiceRow = Tables<'invoices'>;

/**
 * Invoice item row type
 */
export type InvoiceItemRow = Tables<'invoice_items'>;

/**
 * Credit note row type
 */
export type CreditNoteRow = Tables<'credit_notes'>;

/**
 * Missing payment obligation type
 * TODO: Replace with proper type when views are added to generated types
 * This represents data from a database view that isn't yet in the generated types
 */
export interface MissingPaymentObligation {
  sessions_students_id: string;
  session_start_at: string | null;
  subject_name: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
  expected_amount_cents: number | null;
  currency: string | null;
  skip_reason: string | null;
  student_email: string | null;
  student_phone: string | null;
}

/**
 * Failed payment attempt type
 * TODO: Replace with proper type when views are added to generated types
 * This represents data from a database view that isn't yet in the generated types
 */
export interface FailedPaymentAttempt {
  payment_attempt_id: string;
  session_start_at: string | null;
  subject_name: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
  attempt_number: number | null;
  amount_cents: number | null;
  currency: string | null;
  failure_code: string | null;
  card_brand: string | null;
  card_last4: string | null;
  student_email: string | null;
  student_phone: string | null;
}

/**
 * Stuck payment attempt type
 * TODO: Replace with proper type when views are added to generated types
 * This represents data from a database view that isn't yet in the generated types
 */
export interface StuckPaymentAttempt {
  id: string;
  created_at: string | null;
  session_start_at: string | null;
  subject_name: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
  attempt_number: number | null;
  amount_cents: number | null;
  currency: string | null;
  status: string | null;
  stripe_payment_intent_id: string | null;
}
