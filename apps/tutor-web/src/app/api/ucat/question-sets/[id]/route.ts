import { NextRequest, NextResponse } from 'next/server'
import { normalizeSetTiming, SetTimingValidationError } from '@/features/ucat/sets/lib/set-timing-payload'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import { jsonUcatDeleteErrorResponse, jsonUcatVisibilityErrorResponse, ucatMemberIds } from '@/features/ucat/shared/server/delete-blocked-response'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const timing = normalizeSetTiming(body)
    const { id } = await params
    const client = access.userClient as unknown as UcatTutorSupabaseClient

    const { data, error } = await client.rpc('tutor_ucat_upsert_question_set_v2', {
      p_set_id: id,
      p_authoring_note: body.authoringNote ?? null,
      p_description: body.description ?? {},
      p_timing_mode: timing.timingMode,
      p_pace_multiplier: timing.paceMultiplier,
      p_fixed_time_limit_seconds: timing.fixedTimeLimitSeconds,
      p_set_format: body.setFormat,
      p_access_scope: body.accessScope ?? 'public',
      p_stem_ids: body.stemIds ?? [],
      p_section_id: body.sectionId,
      p_reference_blueprint_id: body.referenceBlueprintId,
    })

    if (error) {
      return jsonUcatVisibilityErrorResponse(client, {
        contentType: 'set',
        contentId: id,
        accessScope: body.accessScope === 'private' ? 'private' : 'public',
        memberIds: ucatMemberIds(body.stemIds),
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ id: data })
  } catch (error) {
    if (error instanceof SetTimingValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { id } = await params
  const { error } = await client.rpc('tutor_ucat_delete_question_set', { p_set_id: id })

  if (error) {
    return jsonUcatDeleteErrorResponse(client, {
      contentType: 'set',
      contentId: id,
      errorMessage: error.message,
    })
  }
  return NextResponse.json({ ok: true })
}
