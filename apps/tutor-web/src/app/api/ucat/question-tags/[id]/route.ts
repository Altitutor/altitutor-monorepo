import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { assertTagParentValid } from '@/features/ucat/shared/server/taxonomy-mutations'

function toRichText(text?: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text
          ? [
              {
                type: 'text',
                text,
              },
            ]
          : [],
      },
    ],
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const { data: staffId } = await access.userClient.rpc('current_tutor_id')
    const service = getServiceRoleClient()

    const parentTagId =
      body.parentTagId !== undefined ? body.parentTagId || null : undefined
    const sectionId =
      body.sectionId !== undefined ? body.sectionId || null : undefined

    let resolvedParent = parentTagId
    let resolvedSection = sectionId

    if (body.reparentOnly) {
      resolvedParent = body.parentTagId ?? null
      if (resolvedParent) {
        resolvedSection = null
      } else {
        resolvedSection = body.sectionId ?? null
      }
    } else if (parentTagId !== undefined || sectionId !== undefined) {
      const { data: existing } = await service
        .from('question_tags')
        .select('parent_question_tag_id, ucat_section_id')
        .eq('id', params.id)
        .single()

      const nextParent =
        parentTagId !== undefined ? parentTagId : existing?.parent_question_tag_id ?? null
      resolvedParent = nextParent
      if (nextParent) {
        resolvedSection = null
      } else if (sectionId !== undefined) {
        resolvedSection = sectionId
      } else {
        resolvedSection = existing?.ucat_section_id ?? null
      }
    }

    if (resolvedParent) {
      const parentError = await assertTagParentValid(service, params.id, resolvedParent)
      if (parentError) {
        return NextResponse.json({ error: parentError }, { status: 400 })
      }
      resolvedSection = null
    }

    const updatePayload: Record<string, unknown> = {
      updated_by: staffId,
    }

    if (!body.reparentOnly) {
      if (body.name !== undefined) updatePayload.name = body.name
      if (body.description !== undefined) {
        updatePayload.description = toRichText(body.description)
      }
    }

    if (resolvedParent !== undefined) {
      updatePayload.parent_question_tag_id = resolvedParent
    }
    if (resolvedSection !== undefined) {
      updatePayload.ucat_section_id = resolvedSection
    }

    const { data, error } = await service
      .from('question_tags')
      .update(updatePayload)
      .eq('id', params.id)
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ id: data.id })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const service = getServiceRoleClient()
  const { error } = await service.from('question_tags').delete().eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
