'use client';

import { useEffect, useId, useMemo } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useSupabaseClient } from '@/shared/lib/supabase/client';

type RealtimeRow = {
  id?: string | null;
  issue_id?: string | null;
  project_id?: string | null;
};

type RealtimeInvalidationOptions = {
  table: string;
  queryKey: QueryKey;
  detailKey?: (id: string) => QueryKey;
  getRelatedKeys?: (row: RealtimeRow) => QueryKey[];
  extraQueryKeys?: QueryKey[];
};

export function useSupabaseRealtimeInvalidation({
  table,
  queryKey,
  detailKey,
  getRelatedKeys,
  extraQueryKeys = [],
}: RealtimeInvalidationOptions) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const queryKeyHash = JSON.stringify(queryKey);
  const extraQueryKeysHash = JSON.stringify(extraQueryKeys);
  const stableQueryKey = useMemo(() => JSON.parse(queryKeyHash) as QueryKey, [queryKeyHash]);
  const stableExtraQueryKeys = useMemo(
    () => JSON.parse(extraQueryKeysHash) as QueryKey[],
    [extraQueryKeysHash]
  );

  useEffect(() => {
    const invalidateKey = (key: QueryKey) => {
      void queryClient.invalidateQueries({ queryKey: key });
    };

    const channel = supabase
      .channel(`admin-realtime-${table}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          const newRow = (payload.new ?? {}) as RealtimeRow;
          const oldRow = (payload.old ?? {}) as RealtimeRow;
          const row = payload.eventType === 'DELETE' ? oldRow : newRow;
          const id = newRow.id ?? oldRow.id ?? null;

          invalidateKey(stableQueryKey);
          stableExtraQueryKeys.forEach(invalidateKey);

          if (id && detailKey) {
            if (payload.eventType === 'DELETE') {
              queryClient.removeQueries({ queryKey: detailKey(id) });
            } else {
              invalidateKey(detailKey(id));
            }
          }

          getRelatedKeys?.(row).forEach(invalidateKey);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    detailKey,
    getRelatedKeys,
    instanceId,
    queryClient,
    stableExtraQueryKeys,
    stableQueryKey,
    supabase,
    table,
  ]);
}
