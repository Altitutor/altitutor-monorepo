import type { Tables, Database, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { staffApi } from '@/features/staff/api/staff';

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

/**
 * Fetch all subsidies for a student with subject details
 */
export async function fetchStudentSubsidies(studentId: string): Promise<StudentSubsidyRow[]> {
  const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
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
 * Create a new subsidy for a student
 * Automatically sets created_by to current staff member
 */
export async function createSubsidy(input: CreateSubsidyInput): Promise<StudentSubsidyRow> {
  // Get current staff member
  const currentStaff = await staffApi.getCurrentStaff();
  if (!currentStaff) {
    throw new Error('Unable to identify current staff member');
  }

  const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
    .from('student_subsidies')
    .insert({
      student_id: input.student_id,
      subject_id: input.subject_id,
      billing_type: input.billing_type,
      price_cents: input.price_cents,
      currency: input.currency || 'AUD',
      effective_from: input.effective_from || new Date().toISOString(),
      effective_until: input.effective_until || null,
      created_by: currentStaff.id,
    })
    .select(`
      *,
      subject:subjects(*)
    `)
    .single();

  if (error) throw error;
  return data as StudentSubsidyRow;
}

/**
 * Update an existing subsidy
 */
export async function updateSubsidy(
  subsidyId: string,
  updates: UpdateSubsidyInput
): Promise<StudentSubsidyRow> {
  const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
    .from('student_subsidies')
    .update(updates)
    .eq('id', subsidyId)
    .select(`
      *,
      subject:subjects(*)
    `)
    .single();

  if (error) throw error;
  return data as StudentSubsidyRow;
}

/**
 * Delete a subsidy
 */
export async function deleteSubsidy(subsidyId: string): Promise<void> {
  const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
    .from('student_subsidies')
    .delete()
    .eq('id', subsidyId);

  if (error) throw error;
}

