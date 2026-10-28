import { captureApiError } from '@/lib/sentry/capture-api-error'
import { NextRequest, NextResponse } from 'next/server'
import type { Json } from '@altitutor/shared'
import {
  readViewWriteBody,
  requireTutorActor,
  toQuickFilter,
  viewWriteDecision,
} from '@/features/quick-filters/server/access'

export async function POST(request: NextRequest) {
  try {
    const actor = await requireTutorActor()
    if ('error' in actor) return actor.error
    const body = readViewWriteBody(await request.json())
    if (!body) return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
    const decision = viewWriteDecision(actor.userId, null, body)
    if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: 400 })
    const { data, error } = await actor.service
      .from('quick_filters')
      .insert({
        name: decision.row.name,
        target_entity: decision.row.target_entity,
        user_id: decision.row.user_id,
        config: decision.row.config as Json,
      })
      .select('id, name, target_entity, user_id, config, created_at, updated_at')
      .single()
    if (error || !data) {
      captureApiError(error ?? new Error('Missing saved view'), '/api/quick-filters')
      return NextResponse.json({ error: 'Could not save the view.' }, { status: 500 })
    }
    return NextResponse.json(toQuickFilter(data))
  } catch (error) {
    captureApiError(error, '/api/quick-filters')
    return NextResponse.json({ error: 'Could not save the view.' }, { status: 500 })
  }
}
