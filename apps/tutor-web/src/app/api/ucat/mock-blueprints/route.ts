import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import type { MockBlueprintPayload } from '@/features/ucat/mock-blueprints/types'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = (await request.json()) as MockBlueprintPayload
    const service = getServiceRoleClient()
    const { data, error } = await (service as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
    }).rpc('tutor_ucat_create_mock_blueprint_version', {
      p_source_blueprint_id: body.sourceBlueprintId ?? null,
      p_test_year: body.testYear,
      p_official_facts_label: body.officialFactsLabel,
      p_altitutor_policy_label: body.altitutorPolicyLabel,
      p_sections: body.sections,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ id: String(data) })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
