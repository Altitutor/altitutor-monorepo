import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type StudentSubsidyRow = Tables<'student_subsidies'> & {
  subject: Tables<'subjects'>;
};

export type CreateSubsidyInput = {
  student_id: string;
  subject_id: string;
  billing_type: 'CLASS' | 'EXAM_COURSE' | 'DRAFTING';
  price_cents: number;
  currency?: string;
  effective_from?: string;
  effective_until?: string | null;
};

export type UpdateSubsidyInput = {
  subject_id?: string;
  billing_type?: 'CLASS' | 'EXAM_COURSE' | 'DRAFTING';
  price_cents?: number;
  currency?: string;
  effective_from?: string;
  effective_until?: string | null;
};

function subsidyClient() {
  return getSupabaseClient() as SupabaseClient<Database>;
}

async function fetchSubsidyById(subsidyId: string): Promise<StudentSubsidyRow> {
  const { data, error } = await subsidyClient()
    .from('student_subsidies')
    .select(`
      *,
      subject:subjects(*)
    `)
    .eq('id', subsidyId)
    .single();

  if (error) throw error;
  return data as StudentSubsidyRow;
}

/**
 * Fetch all subsidies for a student with subject details
 */
export async function fetchStudentSubsidies(studentId: string): Promise<StudentSubsidyRow[]> {
  const { data, error } = await subsidyClient()
    .from('student_subsidies')
    .select(`
      *,
      subject:subjects(*)
    `)
    .eq('student_id', studentId)
    .order('effective_from', { ascending: false });

  if (error) throw error;
  return (data ?? []) as StudentSubsidyRow[];
}

/**
 * Create a subsidy. Any other subsidy for the same subject and billing type
 * is closed or split so this window is the only rate.
 */
export async function createSubsidy(input: CreateSubsidyInput): Promise<StudentSubsidyRow> {
  const { data: subsidyId, error } = await subsidyClient().rpc('save_student_subsidy', {
    p_student_id: input.student_id,
    p_subject_id: input.subject_id,
    p_billing_type: input.billing_type,
    p_price_cents: input.price_cents,
    p_currency: input.currency || 'AUD',
    p_effective_from: input.effective_from || new Date().toISOString(),
    p_effective_until: input.effective_until ?? null,
  });

  if (error) throw error;
  if (!subsidyId) throw new Error('Subsidy was not saved');
  return fetchSubsidyById(subsidyId);
}

/**
 * Update a subsidy. Overlapping subsidies for the same subject and billing type
 * are closed or split around the saved window.
 */
export async function updateSubsidy(
  subsidyId: string,
  updates: UpdateSubsidyInput
): Promise<StudentSubsidyRow> {
  const existing = await fetchSubsidyById(subsidyId);
  const { data: savedId, error } = await subsidyClient().rpc('save_student_subsidy', {
    p_id: subsidyId,
    p_student_id: existing.student_id,
    p_subject_id: updates.subject_id ?? existing.subject_id,
    p_billing_type: updates.billing_type ?? existing.billing_type,
    p_price_cents: updates.price_cents ?? existing.price_cents,
    p_currency: updates.currency ?? existing.currency,
    p_effective_from: updates.effective_from ?? existing.effective_from,
    p_effective_until: updates.effective_until === undefined
      ? existing.effective_until
      : updates.effective_until,
  });

  if (error) throw error;
  if (!savedId) throw new Error('Subsidy was not saved');
  return fetchSubsidyById(savedId);
}

/**
 * Delete a subsidy
 */
export async function deleteSubsidy(subsidyId: string): Promise<void> {
  const { error } = await subsidyClient()
    .from('student_subsidies')
    .delete()
    .eq('id', subsidyId);

  if (error) throw error;
}

