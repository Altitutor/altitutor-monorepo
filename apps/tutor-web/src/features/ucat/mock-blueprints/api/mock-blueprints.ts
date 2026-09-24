import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MockBlueprintPayload, MockBlueprintRow } from '@/features/ucat/mock-blueprints/types'

export const ucatMockBlueprintsApi = {
  async list(): Promise<MockBlueprintRow[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_mock_blueprints')
      .select('*')
      .order('test_year', { ascending: false })
      .order('version', { ascending: false })
    if (error) throw error
    return (data ?? []).flatMap((row) =>
      row.id && row.code && row.test_year != null && row.version != null
        ? [{
            id: row.id,
            code: row.code,
            test_year: row.test_year,
            version: row.version,
            official_facts_label: row.official_facts_label ?? '',
            altitutor_policy_label: row.altitutor_policy_label ?? '',
            created_at: row.created_at ?? null,
            sections: row.sections,
          }]
        : [],
    )
  },

  async createVersion(payload: MockBlueprintPayload): Promise<{ id: string }> {
    const response = await fetch('/api/ucat/mock-blueprints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error ?? 'Failed to create mock blueprint version')
    return body as { id: string }
  },
}

