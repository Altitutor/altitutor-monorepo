'use client';

import { encodeViewConfig, type DisplaySettings, type QuickFilter } from '@altitutor/shared';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';

export const STUDENT_FILTER_KEYS = ['relationship', 'status', 'curriculum', 'yearLevel', 'subject', 'inPersonClass', 'product', 'entitlement', 'accountClass', 'queue'];
export const STUDENT_VIEW_DEFAULTS = {
  in_person: { filters: { relationship: ['in_person'], status: ['ACTIVE'] }, sortBy: 'status', sortDirection: 'desc', groupBy: null, visibleColumns: ['status', 'education', 'student', 'classes'] },
  online: { filters: { relationship: ['online'], accountClass: ['external'] }, sortBy: 'last_name', sortDirection: 'asc', groupBy: null, visibleColumns: ['student', 'products', 'online_since'] },
  trial: { layout: 'board', filters: { relationship: ['trial'], queue: ['open'] }, sortBy: null, sortDirection: 'asc', groupBy: 'stage', visibleColumns: [] },
} satisfies Record<string, DisplaySettings>;

const defaults: QuickFilter[] = (['in_person', 'online', 'trial'] as const).map((key) => ({
  id: `builtin:students:${key}`, name: { in_person: 'In person', online: 'Online', trial: 'Trial' }[key], target_entity: 'students', user_id: null, created_at: '', updated_at: '', config: encodeViewConfig(STUDENT_VIEW_DEFAULTS[key]),
}));

/** All relationship modes share the same saved-view namespace and toolbar. */
export function useStudentViews() {
  const query = useQuickFilters('students');
  return [...defaults, ...(query.data ?? [])];
}
