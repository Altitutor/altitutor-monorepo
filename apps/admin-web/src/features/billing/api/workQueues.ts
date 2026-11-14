import { queryOptions } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { reconciliationApi } from '@/features/reconciliation/api/reconciliation';
import { reconciliationKeys } from '@/features/reconciliation/api/queryKeys';
import type { UninvoicedSession, VoidInvoiceSession } from '@/features/reconciliation/types';
import { buildFutureSessionCharges } from '@altitutor/shared';
import { pricingApi } from './pricing';
import { subjectPricingOverridesApi } from './subject-pricing-overrides';

export type BillingCharge = (UninvoicedSession | VoidInvoiceSession) & { reason: 'uninvoiced' | 'voided' };

export function combineBillingCharges(uninvoiced: UninvoicedSession[], voided: VoidInvoiceSession[]): BillingCharge[] {
  return [...new Map<string, BillingCharge>([
    ...uninvoiced.map((row): [string, BillingCharge] => [row.sessions_students_id, { ...row, reason: 'uninvoiced' }]),
    ...voided.map((row): [string, BillingCharge] => [row.sessions_students_id, { ...row, reason: 'voided' }]),
  ]).values()];
}

export async function loadBillingCharges() {
  const [uninvoiced, voided] = await Promise.all([reconciliationApi.getUninvoicedSessions(), reconciliationApi.getVoidInvoiceSessions()]);
  return combineBillingCharges(uninvoiced, voided);
}

export const billingChargesQuery = queryOptions({
  queryKey: reconciliationKeys.billingCharges(),
  queryFn: loadBillingCharges,
  staleTime: 30_000,
  refetchOnMount: 'always',
});

export async function estimateBillingCharges(rows: BillingCharge[]) {
  const db = getSupabaseClient();
  const [pricing, pricingOverrides] = await Promise.all([pricingApi.getBillingPricing(), subjectPricingOverridesApi.getAllSubjectOverrides()]);
  const estimates: Record<string, { amountCents: number; currency: string }> = {};
  const studentIds = [...new Set(rows.map((row) => row.student_id))];
  for (let start = 0; start < studentIds.length; start += 100) {
    const ids = studentIds.slice(start, start + 100);
    const subsidies = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from('student_subsidies').select('*').in('student_id', ids).order('id').range(offset, offset + 499);
      if (error) throw error;
      subsidies.push(...data);
      if (data.length < 500) break;
    }
    for (const row of rows.filter((row) => ids.includes(row.student_id))) {
      if (!row.subject_id || !row.billing_type || !row.session_end_at || !pricing.some((rate) => rate.billing_type === row.billing_type)) continue;
      const [charge] = buildFutureSessionCharges([{
        id: row.sessions_students_id, subjectId: row.subject_id, billingType: row.billing_type,
        startAt: row.session_start_at, endAt: row.session_end_at,
      }], { studentId: row.student_id, pricing, pricingOverrides, subsidies });
      estimates[row.sessions_students_id] = charge;
    }
  }
  return estimates;
}

export async function loadAdjustmentPeopleAndSessions(studentIds: string[], sessionIds: string[]) {
  const db = getSupabaseClient();
  const students: Record<string, string> = {};
  const sessions: Record<string, string> = {};
  for (let start = 0; start < studentIds.length; start += 100) {
    const { data, error } = await db.from('students').select('id, first_name, last_name').in('id', studentIds.slice(start, start + 100));
    if (error) throw error;
    for (const row of data) students[row.id] = [row.first_name, row.last_name].filter(Boolean).join(' ');
  }
  for (let start = 0; start < sessionIds.length; start += 100) {
    const { data, error } = await db.from('sessions').select('id, short_name, long_name').in('id', sessionIds.slice(start, start + 100));
    if (error) throw error;
    for (const row of data) sessions[row.id] = row.short_name || row.long_name || 'Session';
  }
  return { students, sessions };
}
