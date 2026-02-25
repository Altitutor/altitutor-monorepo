import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

export type UcatSectionPayload = {
  id?: string | null
  sectionNumber: number
  name: string
  displayColumns: 1 | 2
  description?: string
}

export const ucatSectionsApi = {
  async list() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase.from('vtutor_ucat_sections').select('*').order('section_number')
    if (error) throw error
    return data ?? []
  },

  async create(payload: UcatSectionPayload) {
    const response = await fetch('/api/ucat/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to create section')
    }

    return response.json() as Promise<{ id: string }>
  },

  async update(id: string, payload: UcatSectionPayload) {
    const response = await fetch(`/api/ucat/sections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to update section')
    }

    return response.json() as Promise<{ id: string }>
  },

  async remove(id: string) {
    const response = await fetch(`/api/ucat/sections/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to delete section')
    }
  },
}
