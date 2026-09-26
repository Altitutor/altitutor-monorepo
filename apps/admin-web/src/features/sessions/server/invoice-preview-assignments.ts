import { selectRunnerInvoiceAssignmentIds, type Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

const ADJUSTMENT_CONTROLLED_STATUSES = ['pending', 'processing', 'retryable', 'failed'] as const;

export async function loadPreviewableAssignmentIds(
  admin: SupabaseClient<Database>,
  studentId: string,
): Promise<string[]> {
  const { data: assignmentRows, error: assignmentError } = await admin
    .from('sessions_students')
    .select('id')
    .eq('student_id', studentId);
  if (assignmentError) throw assignmentError;

  const assignmentIds = (assignmentRows ?? []).map((row) => row.id);
  if (assignmentIds.length === 0) return [];

  const [chargeableResult, invoicedResult, adjustmentResult] = await Promise.all([
    admin.rpc('get_chargeable_sessions_students_ids', {
      p_sessions_students_ids: assignmentIds,
    }),
    admin.rpc('get_invoiced_sessions_students_ids', {
      p_sessions_students_ids: assignmentIds,
    }),
    admin
      .from('session_billing_adjustments')
      .select('sessions_students_id, sessions_students!inner(student_id)')
      .eq('sessions_students.student_id', studentId)
      .in('status', [...ADJUSTMENT_CONTROLLED_STATUSES]),
  ]);

  const queryError = chargeableResult.error || invoicedResult.error || adjustmentResult.error;
  if (queryError) throw queryError;

  return selectRunnerInvoiceAssignmentIds(
    assignmentIds,
    new Set(chargeableResult.data ?? []),
    new Set(invoicedResult.data ?? []),
    new Set((adjustmentResult.data ?? []).map((row) => row.sessions_students_id)),
  );
}
