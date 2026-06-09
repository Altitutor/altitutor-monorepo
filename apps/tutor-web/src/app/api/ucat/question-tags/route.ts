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

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const { data: staffId } = await access.userClient.rpc('current_tutor_id')
    const service = getServiceRoleClient()

    const parentTagId = body.parentTagId || null
    const sectionId = parentTagId ? null : body.sectionId || null

    const { data, error } = await service
      .from('question_tags')
      .insert({
        name: body.name,
        description: toRichText(body.description),
        parent_question_tag_id: parentTagId,
        ucat_section_id: sectionId,
        created_by: staffId,
        updated_by: staffId,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ id: data.id })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
