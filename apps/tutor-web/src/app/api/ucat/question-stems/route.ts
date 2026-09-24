import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor, type UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import { jsonUcatVisibilityErrorResponse } from '@/features/ucat/shared/server/delete-blocked-response'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const client = access.userClient as unknown as UcatTutorSupabaseClient

    const { data, error } = await client.rpc('tutor_ucat_upsert_question_stem_bundle', {
      p_stem_id: body.stemId ?? null,
      p_section_id: body.sectionId,
      p_question_stem_category_id: body.categoryId ?? null,
      p_stem_text: body.stemText ?? {},
      p_access_scope: body.accessScope ?? 'public',
      p_questions: body.questions ?? [],
      p_source_channel: body.sourceChannel ?? 'individual',
      p_tutor_source_note: body.tutorSourceNote ?? null,
    })

    if (error) {
      return jsonUcatVisibilityErrorResponse(client, {
        contentType: 'stem',
        contentId: typeof body.stemId === 'string' ? body.stemId : '00000000-0000-0000-0000-000000000000',
        accessScope: body.accessScope === 'private' ? 'private' : 'public',
        errorMessage: error.message,
      })
    }
    return NextResponse.json({ id: data })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: String(error) }, { status: 400 })
  }
}
