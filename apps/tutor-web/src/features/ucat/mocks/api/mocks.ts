import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatContentStatus, UcatMockPayload } from '@/features/ucat/shared/types'
import {
  readUcatBulkStatusResponse,
  throwFirstUcatBulkStatusFailure,
} from '@/features/ucat/shared/lifecycle-errors'

export const ucatMocksApi = {
  async blueprints() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_mock_blueprints')
      .select('*')
      .order('test_year', { ascending: false })
      .order('version', { ascending: false })
    if (error) throw error
    return data ?? []
  },

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

  async blueprintAudits(mockId: string) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_mock_blueprint_audits')
      .select('*')
      .eq('mock_id', mockId)
      .order('checked_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async auditBlueprint(mockId: string, blueprintId: string) {
    const response = await fetch(`/api/ucat/mocks/${mockId}/blueprint-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blueprintId }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error ?? 'Failed to audit blueprint candidate')
    return body as { auditId: string }
  },

  async confirmBlueprintAudit(mockId: string, auditId: string) {
    const response = await fetch(`/api/ucat/mocks/${mockId}/blueprint-audit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditId }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error ?? 'Failed to confirm blueprint candidate')
    return body as { auditId: string }
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

  async setStatus(mockId: string, status: UcatContentStatus) {
    const result = await this.bulkSetStatus([mockId], status)
    throwFirstUcatBulkStatusFailure(result)
    return result
  },

  async bulkSetStatus(mockIds: string[], status: UcatContentStatus) {
    const response = await fetch('/api/ucat/content-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'mock', contentIds: mockIds, status }),
    })
    return readUcatBulkStatusResponse(response, 'Failed to update mock status')
  },

  async bulkRestoreStatus(mockIds: string[], currentStatus: UcatContentStatus, previousStatus: UcatContentStatus) {
    const response = await fetch('/api/ucat/content-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'mock', contentIds: mockIds, status: currentStatus, previousStatus }),
    })
    return readUcatBulkStatusResponse(response, 'Failed to restore mock status')
  },

  async remove(mockId: string) {
    const response = await fetch(`/api/ucat/mocks/${mockId}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to delete mock')
    }
  },

  async bulkRemove(mockIds: string[]) {
    const response = await fetch('/api/ucat/mocks/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mockIds }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to bulk delete mocks')
    }
    return response.json() as Promise<{ ok: true }>
  },

  async restore(mockId: string) {
    const response = await fetch(`/api/ucat/mocks/${mockId}/restore`, { method: 'POST' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to restore mock')
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
