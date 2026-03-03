import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const { data: staffId } = await access.userClient.rpc('current_tutor_id')
    const service = getServiceRoleClient()

    const { data, error } = await service
      .from('ucat_sections')
      .insert({
        section_number: body.sectionNumber,
        name: body.name,
        display_columns: body.displayColumns,
        instructions_text: body.instructionsText ?? null,
        time_limit_seconds: body.timeLimitSeconds ?? null,
        number_of_questions: body.numberOfQuestions ?? null,
        instructions_time_limit_seconds: body.instructionsTimeLimitSeconds ?? null,
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
