import type { Database, QuickFilter, QuickFilterConfig } from '@altitutor/shared'
import { getViewSettings } from '@altitutor/shared'
import { getSupabaseClient } from '@/shared/lib/supabase/client'

type ViewRow = Database['public']['Views']['vtutor_quick_filters']['Row']
type SavedViewInput = Omit<QuickFilter, 'id' | 'created_at' | 'updated_at'> & { id?: string }

function asQuickFilter(row: ViewRow): QuickFilter {
  if (!row.id || !row.name || !row.target_entity || !row.created_at || !row.updated_at || !row.config || !getViewSettings(row.config as QuickFilterConfig)) {
    throw new Error('Saved view row is incomplete.')
  }
  return {
    id: row.id,
    name: row.name,
    target_entity: row.target_entity,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    config: row.config as QuickFilterConfig,
  }
}

async function readResponse(response: Response): Promise<QuickFilter> {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : 'Could not save the view.'
    throw new Error(message)
  }
  if (!body || typeof body !== 'object' || !('id' in body)) throw new Error('Could not save the view.')
  return body as QuickFilter
}

export const tutorViewsApi = {
  list: async (targetEntity: string): Promise<QuickFilter[]> => {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('vtutor_quick_filters')
      .select('id, user_id, target_entity, name, config, created_at, updated_at')
      .eq('target_entity', targetEntity)
      .order('name')
    if (error) throw error
    return (data ?? []).map(asQuickFilter)
  },
  save: async (view: SavedViewInput): Promise<QuickFilter> => {
    const response = await fetch(view.id ? `/api/quick-filters/${view.id}` : '/api/quick-filters', {
      method: view.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: view.name,
        target_entity: view.target_entity,
        user_id: view.user_id,
        config: view.config,
      }),
    })
    return readResponse(response)
  },
  remove: async (id: string): Promise<void> => {
    const response = await fetch(`/api/quick-filters/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null)
      const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Could not delete the view.'
      throw new Error(message)
    }
  },
}
