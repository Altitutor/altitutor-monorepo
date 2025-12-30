import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

export type SubjectPricingOverrideRow = Tables<'billing_pricing_overrides'> & {
  subject: {
    id: string;
    name: string;
    curriculum: string | null;
    year_level: number | null;
  };
};

export interface CreateSubjectOverrideInput {
  subject_id: string;
  billing_type: 'CLASS' | 'EXAM_COURSE' | 'DRAFTING';
  hourly_rate_cents: number;
  currency?: string;
  effective_from?: string;
  effective_until?: string | null;
}

export interface UpdateSubjectOverrideInput {
  hourly_rate_cents?: number;
  currency?: string;
  effective_from?: string;
  effective_until?: string | null;
}

export const subjectPricingOverridesApi = {
  async getAllSubjectOverrides(): Promise<SubjectPricingOverrideRow[]> {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('billing_pricing_overrides')
      .select(`
        *,
        subject:subjects(id, name, curriculum, year_level)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as SubjectPricingOverrideRow[];
  },

  async createSubjectOverride(input: CreateSubjectOverrideInput): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('billing_pricing_overrides')
      .insert({
        subject_id: input.subject_id,
        billing_type: input.billing_type,
        hourly_rate_cents: input.hourly_rate_cents,
        currency: input.currency || 'AUD',
        effective_from: input.effective_from || new Date().toISOString(),
        effective_until: input.effective_until || null,
      });
    if (error) throw error;
  },

  async updateSubjectOverride(
    overrideId: string,
    updates: UpdateSubjectOverrideInput
  ): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('billing_pricing_overrides')
      .update(updates)
      .eq('id', overrideId);
    if (error) throw error;
  },

  async deleteSubjectOverride(overrideId: string): Promise<void> {
    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('billing_pricing_overrides')
      .delete()
      .eq('id', overrideId);
    if (error) throw error;
  },
};

