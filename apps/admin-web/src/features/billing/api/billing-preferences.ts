import type { Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BillingPreferences {
  auto_bill_enabled: boolean;
  invoice_email_to_student: boolean;
  invoice_email_to_parents: boolean;
}

const DEFAULT_PREFERENCES: BillingPreferences = {
  auto_bill_enabled: true,
  invoice_email_to_student: true,
  invoice_email_to_parents: true,
};

/**
 * Fetch billing preferences for a student.
 * Returns defaults if no billing account exists yet.
 */
export async function getBillingPreferences(
  studentId: string
): Promise<BillingPreferences> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from('students_billing')
    .select('auto_bill_enabled, invoice_email_to_student, invoice_email_to_parents')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) throw error;

  return {
    auto_bill_enabled: data?.auto_bill_enabled ?? DEFAULT_PREFERENCES.auto_bill_enabled,
    invoice_email_to_student:
      data?.invoice_email_to_student ?? DEFAULT_PREFERENCES.invoice_email_to_student,
    invoice_email_to_parents:
      data?.invoice_email_to_parents ?? DEFAULT_PREFERENCES.invoice_email_to_parents,
  };
}

export interface BillingPreferencesUpdate {
  auto_bill_enabled?: boolean;
  invoice_email_to_student?: boolean;
  invoice_email_to_parents?: boolean;
}

/**
 * Update billing preferences for a student via API route.
 */
export async function updateBillingPreferences(
  studentId: string,
  update: BillingPreferencesUpdate
): Promise<BillingPreferences> {
  const response = await fetch(`/api/students/${studentId}/billing-preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update billing preferences');
  }

  const result = await response.json();
  return result.billing_preferences ?? {
    ...DEFAULT_PREFERENCES,
    ...update,
  };
}
