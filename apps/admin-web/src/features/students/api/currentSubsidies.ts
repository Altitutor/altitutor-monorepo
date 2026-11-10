import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

export function currentSubsidies(db: SupabaseClient<Database>, now = new Date().toISOString()) {
  return db.from('student_subsidies')
    .select('id, student_id, price_cents, currency, billing_type, subject:subjects(name)')
    .lte('effective_from', now).or(`effective_until.is.null,effective_until.gt.${now}`);
}
