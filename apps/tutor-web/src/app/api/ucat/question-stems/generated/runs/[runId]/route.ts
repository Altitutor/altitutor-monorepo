import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { runId: string } },
) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null) as { dismissed?: boolean } | null
  if (body?.dismissed !== true) {
    return NextResponse.json({ error: 'Invalid run update' }, { status: 400 })
  }

  const client = access.userClient as unknown as SupabaseClient<Database>
  const { data: staffId, error: staffError } = await client.rpc('current_tutor_id')
  if (staffError || typeof staffId !== 'string') {
    return NextResponse.json({ error: staffError?.message ?? 'Tutor profile not found' }, { status: 403 })
  }

  const { data, error } = await client
    .from('ucat_ai_generation_runs')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', params.runId)
    .eq('created_by', staffId)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'Generation run not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
