export interface FutureInvoicePreview {
  sessions_students_id: string;
  subject_id: string;
  subject_name: string;
  session_start_at: string;
  full_amount_cents: number;
  prior_charge_cents: number;
  currency: string;
}
