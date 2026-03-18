import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server write client not configured' }, { status: 500 })
  }

  const body = (await request.json()) as {
    sectionKey: string
    ucatSectionId: string
    filtersSnapshot?: unknown
    stemsSnapshot?: unknown
    unlimited?: boolean
  }

  if (!body.sectionKey || !body.ucatSectionId) {
    return NextResponse.json(
      { error: 'Missing required fields: sectionKey, ucatSectionId' },
      { status: 400 }
    )
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (studentError) {
    return NextResponse.json({ error: 'Failed to resolve student' }, { status: 500 })
  }

  if (!student) {
    return NextResponse.json({ error: 'No student profile found' }, { status: 404 })
  }

  const insertPayload = {
    student_id: student.id,
    ucat_section_id: body.ucatSectionId,
    section_key: body.sectionKey,
    filters_snapshot: body.filtersSnapshot ?? null,
    stems_snapshot: body.stemsSnapshot ?? null,
    unlimited: body.unlimited ?? false,
  }

  const { data: inserted, error: insertError } = await (
    supabaseAdmin! as { from: (t: string) => ReturnType<NonNullable<typeof supabaseAdmin>['from']> }
  )
    .from('student_practice_sessions')
    .insert(insertPayload)
    .select('id')
    .maybeSingle()

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Failed to create practice session' },
      { status: 500 }
    )
  }

  const insertedData = inserted as { id?: string }
  return NextResponse.json({ id: insertedData.id ?? '' })
}
