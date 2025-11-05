import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SubjectRow = Tables<'subjects'>;

export const pricingApi = {
  async getAllSubjectsWithPricing(): Promise<SubjectRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as SubjectRow[];
  },

  async updateSubjectPricing(
    subjectId: string,
    updates: { session_fee_cents?: number; billing_type?: 'CLASS' | 'EXAM_COURSE' | 'DRAFTING'; currency?: string }
  ): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('subjects')
      .update(updates)
      .eq('id', subjectId);
    if (error) throw error;
  },
};


