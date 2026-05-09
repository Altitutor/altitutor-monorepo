import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';

export type BillingSubsidyRow =
  Database['public']['Functions']['get_my_billing_subsidies']['Returns'][number];

export async function fetchMyBillingSubsidies(): Promise<BillingSubsidyRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_my_billing_subsidies');
  if (error) throw error;
  return data ?? [];
}
