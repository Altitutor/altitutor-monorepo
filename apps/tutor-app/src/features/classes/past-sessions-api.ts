import {
  encodeViewConfig, getViewSettings, tutorDefaultDisplaySettings, tutorViewEntity,
  type PastSessionCursor, type PastSessionHistoryPage, type QuickFilter, type QuickFilterConfig,
} from '@altitutor/shared';

import { supabase } from '@/lib/supabase';
import { tutorWebJson } from '@/lib/tutor-web';

export const pastSessionsViewTarget = tutorViewEntity('past_sessions');
export const historyViewDefaults = tutorDefaultDisplaySettings([]);

export type HistoryFilters = Record<string, string[]>;

export function listPastSessions(filters: HistoryFilters, search: string, cursor: PastSessionCursor | null, userId: string) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (cursor) {
    params.set('before', cursor.startAt);
    params.set('afterId', cursor.id);
  }
  for (const [kind, ids] of Object.entries(filters)) {
    for (const id of ids) if (id) params.append(kind, id);
  }
  return tutorWebJson<PastSessionHistoryPage>(`/api/sessions/past?${params.toString()}`, 'GET', undefined, userId);
}

export async function listPastSessionSubjects(search: string) {
  let query = supabase.from('vtutor_subjects').select('id,name,curriculum,year_level').order('name').order('id').limit(40);
  if (search) query = query.ilike('name', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => row.id ? [{
    id: row.id,
    name: [row.curriculum, row.year_level == null ? null : `Year ${row.year_level}`, row.name].filter(Boolean).join(' '),
  }] : []);
}

export async function listHistoryViews() {
  const { data, error } = await supabase.from('vtutor_quick_filters')
    .select('id,name,target_entity,config,user_id,created_at,updated_at')
    .eq('target_entity', pastSessionsViewTarget).order('name').order('id');
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row): QuickFilter[] => {
    if (!row.id || !row.name || !row.created_at || !row.updated_at || !row.config) return [];
    const config = row.config as QuickFilterConfig;
    if (!getViewSettings(config)) return [];
    return [{
      id: row.id, name: row.name, user_id: row.user_id, target_entity: pastSessionsViewTarget,
      config, created_at: row.created_at, updated_at: row.updated_at,
    }];
  });
}

export function saveHistoryView(name: string, filters: HistoryFilters, userId: string, existing?: QuickFilter) {
  const config = encodeViewConfig({ ...historyViewDefaults, filters });
  const body = { name, target_entity: pastSessionsViewTarget, config, user_id: userId };
  return existing
    ? tutorWebJson<QuickFilter>(`/api/quick-filters/${encodeURIComponent(existing.id)}`, 'PATCH', body, userId)
    : tutorWebJson<QuickFilter>('/api/quick-filters', 'POST', body, userId);
}

export function removeHistoryView(id: string, userId: string) {
  return tutorWebJson(`/api/quick-filters/${encodeURIComponent(id)}`, 'DELETE', undefined, userId);
}
