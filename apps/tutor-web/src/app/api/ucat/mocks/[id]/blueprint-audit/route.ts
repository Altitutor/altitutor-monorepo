import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  const body = await request.json().catch(() => null) as { blueprintId?: unknown } | null
  if (typeof body?.blueprintId !== 'string') return NextResponse.json({ error: 'blueprintId is required' }, { status: 400 })
  const client = access.userClient as unknown as SupabaseClient<Database>
  const { data, error } = await client.rpc('tutor_ucat_audit_mock_blueprint', {
    p_mock_id: params.id,
    p_blueprint_id: body.blueprintId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ auditId: data })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  const body = await request.json().catch(() => null) as { auditId?: unknown } | null
  if (typeof body?.auditId !== 'string') return NextResponse.json({ error: 'auditId is required' }, { status: 400 })
  const client = access.userClient as unknown as SupabaseClient<Database>
  const { data: audit, error: auditError } = await client
    .from('vtutor_ucat_mock_blueprint_audits')
    .select('id')
    .eq('id', body.auditId)
    .eq('mock_id', params.id)
    .maybeSingle()
  if (auditError) return NextResponse.json({ error: auditError.message }, { status: 400 })
  if (!audit) return NextResponse.json({ error: 'Blueprint audit not found for this mock' }, { status: 404 })
  const { data, error } = await client.rpc('tutor_ucat_confirm_mock_blueprint_audit', { p_audit_id: body.auditId })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ auditId: data })
}
