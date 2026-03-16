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
 * Request body for creating a credit note via API
 */
export interface CreateCreditNoteRequest {
  reason: 'duplicate' | 'product_unsatisfactory' | 'order_change' | 'fraudulent' | 'other';
  lines: Array<{
    stripeInvoiceItemId: string;
    quantity?: number;
    amount_cents?: number;
  }>;
  memo?: string;
  effective_at?: string;
  refund_amount_cents?: number;
  credit_amount_cents?: number;
  out_of_band_amount_cents?: number;
  email_type?: 'credit_note' | 'none';
  internal_note?: string;
}

/**
 * Response from create credit note API
 */
export interface CreateCreditNoteResponse {
  creditNoteId: string;
  stripeCreditNoteId: string;
}

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
