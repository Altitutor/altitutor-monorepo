import { captureApiError } from '@/lib/sentry/capture-api-error'
import { NextRequest, NextResponse } from 'next/server'
import type { Json } from '@altitutor/shared'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import {
  canChangeView,
  isSavedViewId,
  readViewWriteBody,
  requireTutorActor,
  toQuickFilter,
  viewWriteDecision,
} from '@/features/quick-filters/server/access'

type Service = ReturnType<typeof getServiceRoleClient>

async function loadExisting(service: Service, id: string) {
  return service
    .from('quick_filters')
    .select('id, name, target_entity, user_id, config, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = params.id
    if (!isSavedViewId(id)) return NextResponse.json({ error: 'View not found' }, { status: 404 })
    const actor = await requireTutorActor()
    if ('error' in actor) return actor.error
    const loaded = await loadExisting(actor.service, id)
    if (loaded.error) {
      captureApiError(loaded.error, '/api/quick-filters/[id]')
      return NextResponse.json({ error: 'Could not save the view.' }, { status: 500 })
    }
    if (!canChangeView(actor.userId, loaded.data)) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 })
    }
    const body = readViewWriteBody(await request.json())
    if (!body) return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
    const decision = viewWriteDecision(actor.userId, loaded.data, body)
    if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: 400 })
    const { data, error } = await actor.service
      .from('quick_filters')
      .update({
        name: decision.row.name,
        target_entity: decision.row.target_entity,
        user_id: decision.row.user_id,
        config: decision.row.config as Json,
      })
      .eq('id', id)
      .select('id, name, target_entity, user_id, config, created_at, updated_at')
      .single()
    if (error || !data) {
      captureApiError(error ?? new Error('Missing saved view'), '/api/quick-filters/[id]')
      return NextResponse.json({ error: 'Could not save the view.' }, { status: 500 })
    }
    return NextResponse.json(toQuickFilter(data))
  } catch (error) {
    captureApiError(error, '/api/quick-filters/[id]')
    return NextResponse.json({ error: 'Could not save the view.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = params.id
    if (!isSavedViewId(id)) return NextResponse.json({ error: 'View not found' }, { status: 404 })
    const actor = await requireTutorActor()
    if ('error' in actor) return actor.error
    const loaded = await loadExisting(actor.service, id)
    if (loaded.error) {
      captureApiError(loaded.error, '/api/quick-filters/[id]')
      return NextResponse.json({ error: 'Could not delete the view.' }, { status: 500 })
    }
    if (!canChangeView(actor.userId, loaded.data)) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 })
    }
    const { error } = await actor.service.from('quick_filters').delete().eq('id', id)
    if (error) {
      captureApiError(error, '/api/quick-filters/[id]')
      return NextResponse.json({ error: 'Could not delete the view.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureApiError(error, '/api/quick-filters/[id]')
    return NextResponse.json({ error: 'Could not delete the view.' }, { status: 500 })
  }
}
