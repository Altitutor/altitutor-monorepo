'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient, type Query, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/shared/lib/supabase/auth';

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
  enabled?: boolean;
};

type Change = { new: RealtimeRow; old: RealtimeRow; eventType: string };
type Listener = (change: Change) => void;
type SharedChannel = { channel: RealtimeChannel; listeners: Set<Listener> };
type Owner = { active: boolean };
type Refresh = {
  owners: Set<Owner>;
  timer?: ReturnType<typeof setTimeout>;
  due: number;
  scheduled: boolean;
  running: boolean;
  dirty: boolean;
};
type Scope = {
  tables: Map<string, SharedChannel>;
  refreshes: Map<Query, Refresh>;
  isCurrent: () => boolean;
  dispose: () => void;
};
const channels = new WeakMap<ReturnType<typeof useSupabaseClient>, WeakMap<QueryClient, Map<string | null, Scope>>>();
let generation = 0;

function scopeFor(supabase: ReturnType<typeof useSupabaseClient>, queryClient: QueryClient, actorId: string | null) {
  let clients = channels.get(supabase);
  if (!clients) channels.set(supabase, clients = new WeakMap());
  let actors = clients.get(queryClient);
  if (!actors) clients.set(queryClient, actors = new Map());
  let scope = actors.get(actorId);
  if (!scope) {
    const entries = actors;
    const created: Scope = {
      tables: new Map(), refreshes: new Map(),
      isCurrent: () => (useAuthStore.getState().user?.id ?? null) === actorId,
      dispose: () => { if (entries.get(actorId) === created) entries.delete(actorId); },
    };
    scope = created;
    actors.set(actorId, scope);
  }
  return scope;
}

function subscribe(
  supabase: ReturnType<typeof useSupabaseClient>, scope: Scope,
  table: string, listener: Listener,
) {
  const { tables } = scope;
  let shared = tables.get(table);
  if (!shared) {
    const listeners = new Set<Listener>();
    let subscribed = false;
    const channel = supabase.channel(`admin-realtime-${table}-${++generation}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        if (scope.isCurrent()) listeners.forEach((changed) => changed(payload));
      })
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          if (subscribed && scope.isCurrent())
            listeners.forEach((changed) => changed({ new: {}, old: {}, eventType: 'RECONNECTED' }));
          subscribed = true;
        }
        if (status === 'CHANNEL_ERROR')
          console.error(`[useSupabaseRealtimeInvalidation] ${table} subscription failed`, error);
      });
    shared = { channel, listeners };
    tables.set(table, shared);
  }
  shared.listeners.add(listener);
  return () => {
    shared.listeners.delete(listener);
    if (!shared.listeners.size) {
      tables.delete(table);
      void supabase.removeChannel(shared.channel);
      if (!tables.size) scope.dispose();
    }
  };
}

async function refresh(scope: Scope, client: QueryClient, query: Query, job: Refresh) {
  const current = () => scope.isCurrent() && scope.refreshes.get(query) === job
    && client.getQueryCache().get(query.queryHash) === query
    && [...job.owners].some((owner) => owner.active);
  if (!current()) {
    scope.refreshes.delete(query);
    return;
  }
  job.scheduled = false;
  job.running = true;
  try {
    // An existing read can finish with a pre-event snapshot. Reuse it, then
    // read once more; events during our own read likewise require a trailing read.
    job.dirty = query.state.fetchStatus === 'fetching';
    if (job.dirty) job.due = Date.now();
    await client.invalidateQueries({ predicate: (candidate) => candidate === query }, { cancelRefetch: false });
  } finally {
    job.running = false;
    if (job.dirty && current()) {
      job.dirty = false;
      schedule(scope, client, query, job);
    } else if (scope.refreshes.get(query) === job) scope.refreshes.delete(query);
  }
}

function schedule(scope: Scope, client: QueryClient, query: Query, job: Refresh) {
  job.scheduled = true;
  const run = () => {
    if (scope.refreshes.get(query) === job && job.scheduled)
      void refresh(scope, client, query, job).catch(() => undefined);
  };
  const delay = Math.max(0, job.due - Date.now());
  if (delay > 0) job.timer = setTimeout(run, delay);
  else queueMicrotask(run);
}

function invalidate(scope: Scope, client: QueryClient, key: QueryKey, owner: Owner, delay: number) {
  for (const query of client.getQueryCache().findAll({ queryKey: key })) {
    let job = scope.refreshes.get(query);
    if (!job) {
      job = { owners: new Set(), due: Infinity, scheduled: false, running: false, dirty: false };
      scope.refreshes.set(query, job);
    }
    job.owners.add(owner);
    if (job.running) {
      job.due = job.dirty ? Math.min(job.due, Date.now() + delay) : Date.now() + delay;
      job.dirty = true;
      continue;
    }
    const due = Date.now() + delay;
    if (job.scheduled && job.due <= due) continue;
    clearTimeout(job.timer);
    job.due = due;
    // Bound bursts by their first deadline, and combine overlapping root/detail
    // filters and table events by the actual cached query, not by filter strings.
    schedule(scope, client, query, job);
  }
}

function release(scope: Scope, owner: Owner) {
  owner.active = false;
  for (const [query, job] of scope.refreshes) {
    job.owners.delete(owner);
    if (!job.owners.size) {
      clearTimeout(job.timer);
      scope.refreshes.delete(query);
    }
  }
}

export function useSupabaseRealtimeInvalidation({
  table,
  queryKey,
  detailKey,
  getRelatedKeys,
  extraQueryKeys = [],
  debounceMs = 0,
  enabled = true,
}: RealtimeInvalidationOptions) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();
  const actorId = useAuthStore((state) => state.user?.id ?? null);
  const queryKeyHash = JSON.stringify(queryKey);
  const extraQueryKeysHash = JSON.stringify(extraQueryKeys);
  const stableQueryKey = useMemo(() => JSON.parse(queryKeyHash) as QueryKey, [queryKeyHash]);
  const stableExtraQueryKeys = useMemo(
    () => JSON.parse(extraQueryKeysHash) as QueryKey[],
    [extraQueryKeysHash]
  );

  const callbacks = useRef({ detailKey, getRelatedKeys });
  useEffect(() => {
    callbacks.current = { detailKey, getRelatedKeys };
  }, [detailKey, getRelatedKeys]);

  useEffect(() => {
    if (!enabled) return;

    const scope = scopeFor(supabase, queryClient, actorId);
    const owner = { active: true };
    const invalidateKey = (key: QueryKey) => invalidate(scope, queryClient, key, owner, debounceMs);

    const unsubscribe = subscribe(supabase, scope, table, (payload) => {
      const { detailKey, getRelatedKeys } = callbacks.current;
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
    });

    return () => {
      release(scope, owner);
      unsubscribe();
    };
  }, [
    debounceMs,
    enabled,
    actorId,
    queryClient,
    stableExtraQueryKeys,
    stableQueryKey,
    supabase,
    table,
  ]);
}
