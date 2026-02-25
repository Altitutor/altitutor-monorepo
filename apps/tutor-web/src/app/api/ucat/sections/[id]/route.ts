import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

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

    const { data, error } = await service
      .from('ucat_sections')
      .update({
        section_number: body.sectionNumber,
        name: body.name,
        display_columns: body.displayColumns,
        description: toRichText(body.description),
        updated_by: staffId,
      })
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
  const { error } = await service.from('ucat_sections').delete().eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
