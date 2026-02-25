import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatMockPayload } from '@/features/ucat/shared/types'

export const ucatMocksApi = {
  async list() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase.from('vtutor_ucat_mocks').select('*').order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async detail(mockId: string) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase.from('vtutor_ucat_mock_detail').select('*').eq('id', mockId).maybeSingle()
    if (error) throw error
    return data
  },

  async create(payload: UcatMockPayload) {
    const response = await fetch('/api/ucat/mocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to create mock')
    }
    return response.json() as Promise<{ id: string }>
  },

  async update(mockId: string, payload: UcatMockPayload) {
    const response = await fetch(`/api/ucat/mocks/${mockId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id: mockId }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to update mock')
    }
    return response.json() as Promise<{ id: string }>
  },

  async remove(mockId: string) {
    const response = await fetch(`/api/ucat/mocks/${mockId}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to delete mock')
    }
  },

  async assignSessions(mockId: string, sessionIds: string[]) {
    const response = await fetch(`/api/ucat/mocks/${mockId}/sessions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to assign sessions')
    }
  },
}
