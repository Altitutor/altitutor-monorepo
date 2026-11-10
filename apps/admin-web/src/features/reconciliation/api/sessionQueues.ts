import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { reconciliationKeys } from './queryKeys';

const queues = {
  uninvoiced: 'vadmin_reconciliation_uninvoiced_sessions',
  unlogged: 'vadmin_reconciliation_unlogged_sessions',
  'void-invoices': 'vadmin_reconciliation_void_invoice_sessions',
  'billing-adjustments': 'vadmin_reconciliation_session_billing_adjustments',
} as const;

export const sessionQueueOptions = [
  { value: 'uninvoiced', label: 'Uninvoiced sessions' },
  { value: 'unlogged', label: 'Unlogged sessions' },
  { value: 'void-invoices', label: 'Sessions on voided invoices' },
  { value: 'billing-adjustments', label: 'Billing adjustments' },
];

export function reconciliationSessionIdsQuery(keys: (keyof typeof queues)[]) {
  return {
    queryKey: [...reconciliationKeys.sessionQueues(), keys],
    staleTime: 120_000,
    queryFn: async () => {
      const db = getSupabaseClient();
      const ids = new Set<string>();
      await Promise.all(keys.map(async (key) => {
        const size = 500;
        for (let offset = 0; ; offset += size) {
          const { data, error } = await db.from(queues[key]).select('session_id')
            .order('session_id').range(offset, offset + size - 1);
          if (error) throw error;
          for (const row of data) if (row.session_id) ids.add(row.session_id);
          if (data.length < size) break;
        }
      }));
      return [...ids].sort();
    },
  };
}

export function useReconciliationSessionIds(values: unknown[] = []) {
  const keys = values.filter((value): value is keyof typeof queues =>
    typeof value === 'string' && Object.hasOwn(queues, value),
  );
  const query = useQuery({ ...reconciliationSessionIdsQuery(keys), enabled: keys.length > 0 });
  return { ...query, active: keys.length > 0 };
}
