import { captureApiError } from '@/lib/sentry/capture-api-error'
import { NextRequest, NextResponse } from 'next/server'
import type { Json } from '@altitutor/shared'
import {
  canChangeNativePastSessionView,
  canChangeView,
  pastSessionViewTarget,
  isSavedViewId,
  readViewWriteBody,
  requireTutorActor,
  toQuickFilter,
  viewWriteDecision,
} from '@/features/quick-filters/server/access'

type Actor = Extract<Awaited<ReturnType<typeof requireTutorActor>>, { userId: string }>

async function loadExisting(actor: Actor, id: string) {
  if (actor.native) {
    const result = await actor.userClient.from('vtutor_quick_filters')
      .select('target_entity, user_id').eq('id', id).maybeSingle()
    return {
      error: result.error,
      data: result.data?.target_entity
        ? { target_entity: result.data.target_entity, user_id: result.data.user_id }
        : null,
    }
  }
  return actor.service.from('quick_filters')
    .select('target_entity, user_id').eq('id', id).maybeSingle()
}

function mayChangeExisting(actor: Actor, view: Awaited<ReturnType<typeof loadExisting>>['data']) {
  return actor.native
    ? canChangeNativePastSessionView(actor.userId, view)
    : canChangeView(actor.userId, view)
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = params.id
    if (!isSavedViewId(id)) return NextResponse.json({ error: 'View not found' }, { status: 404 })
    const actor = await requireTutorActor(request)
    if ('error' in actor) return actor.error
    const loaded = await loadExisting(actor, id)
    if (loaded.error) {
      captureApiError(loaded.error, '/api/quick-filters/[id]')
      return NextResponse.json({ error: 'Could not save the view.' }, { status: 500 })
    }
    if (!mayChangeExisting(actor, loaded.data)) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 })
    }
    const body = readViewWriteBody(await request.json())
    if (!body) return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
    if (actor.native && !canChangeNativePastSessionView(actor.userId, body)) {
      return NextResponse.json({ error: 'Only personal past session views can be saved here.' }, { status: 403 })
    }
    const decision = viewWriteDecision(actor.userId, loaded.data, body)
    if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: 400 })
    let update = actor.service
      .from('quick_filters')
      .update({
        name: decision.row.name,
        target_entity: decision.row.target_entity,
        user_id: decision.row.user_id,
        config: decision.row.config as Json,
      })
      .eq('id', id)
    if (actor.native) update = update.eq('user_id', actor.userId).eq('target_entity', pastSessionViewTarget)
    const { data, error } = await update.select('id, name, target_entity, user_id, config, created_at, updated_at')
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

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = params.id
    if (!isSavedViewId(id)) return NextResponse.json({ error: 'View not found' }, { status: 404 })
    const actor = await requireTutorActor(request)
    if ('error' in actor) return actor.error
    const loaded = await loadExisting(actor, id)
    if (loaded.error) {
      captureApiError(loaded.error, '/api/quick-filters/[id]')
      return NextResponse.json({ error: 'Could not delete the view.' }, { status: 500 })
    }
    if (!mayChangeExisting(actor, loaded.data)) {
      return NextResponse.json({ error: 'View not found' }, { status: 404 })
    }
    let remove = actor.service.from('quick_filters').delete().eq('id', id)
    if (actor.native) remove = remove.eq('user_id', actor.userId).eq('target_entity', pastSessionViewTarget)
    const { error } = await remove
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
