import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SessionPrice {
  amount_cents: number;
  currency: string;
}

export const pricingApi = {
  /**
   * Calculate the price for a drafting session
   * Uses RPC function that takes into account:
   * - Default billing_pricing for DRAFTING
   * - Subject-specific billing_pricing_overrides
   * - Student-specific student_subsidies
   */
  async calculateDraftingSessionPrice(
    subjectId: string,
    startAt: string,
    endAt: string
  ): Promise<SessionPrice> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    // Type assertion needed because RPC function may not be in generated types
    const { data, error } = await (supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: unknown }>)('calculate_session_price', {
      p_subject_id: subjectId,
      p_billing_type: 'DRAFTING',
      p_start_at: startAt,
      p_end_at: endAt,
    });

    if (error) {
      throw error;
    }

    if (!data || typeof data !== 'object' || !('amount_cents' in data) || !('currency' in data)) {
      throw new Error('Invalid response from calculate_session_price');
    }

    return data as SessionPrice;
  },
};
