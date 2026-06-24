'use client';

import { useEffect, useId, useMemo } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useSupabaseClient } from '@/shared/lib/supabase/client';

type RealtimeRow = {
  date?: string | null;
  folder_id?: string | null;
  id?: string | null;
  issue_id?: string | null;
  project_id?: string | null;
  target_id?: string | null;
  target_type?: string | null;
};

type RealtimeInvalidationOptions = {
  table: string;
  queryKey: QueryKey;
  detailKey?: (id: string) => QueryKey;
  getRelatedKeys?: (row: RealtimeRow) => QueryKey[];
  extraQueryKeys?: QueryKey[];
  debounceMs?: number;
};

export function useSupabaseRealtimeInvalidation({
  table,
  queryKey,
  detailKey,
  getRelatedKeys,
  extraQueryKeys = [],
  debounceMs = 0,
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
    const pendingKeys = new Map<string, QueryKey>();
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

    const invalidateKey = (key: QueryKey) => {
      if (debounceMs <= 0) {
        void queryClient.invalidateQueries({ queryKey: key });
        return;
      }

      pendingKeys.set(JSON.stringify(key), key);
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        pendingKeys.forEach((pendingKey) => {
          void queryClient.invalidateQueries({ queryKey: pendingKey });
        });
        pendingKeys.clear();
        debounceTimeout = null;
      }, debounceMs);
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
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(
            `[useSupabaseRealtimeInvalidation] ${table} subscription failed`,
            error
          );
        }
      });

    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      void supabase.removeChannel(channel);
    };
  }, [
    debounceMs,
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
