import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

export type SubjectRow = Tables<'subjects'>;

export const pricingApi = {
  async getAllSubjectsWithPricing(): Promise<SubjectRow[]> {
    const { data, error } = await getSupabaseClient()
      .from('subjects')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as SubjectRow[];
  },

  async updateSubjectPricing(
    subjectId: string,
    updates: { session_fee_cents?: number; billing_type?: string; currency?: string }
  ): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('subjects')
      .update(updates)
      .eq('id', subjectId);
    if (error) throw error;
  },
};


