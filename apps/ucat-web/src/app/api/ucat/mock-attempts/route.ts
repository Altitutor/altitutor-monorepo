import { NextRequest, NextResponse } from 'next/server'
import type { TablesInsert } from '@altitutor/shared'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type MockAttemptInsert = TablesInsert<'student_ucat_mock_attempts'>

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
    mockId: string
  }

  if (!body.mockId) {
    return NextResponse.json({ error: 'Missing mockId' }, { status: 400 })
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

  const insertPayload: MockAttemptInsert = {
    student_id: student.id,
    ucat_mock_id: body.mockId,
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('student_ucat_mock_attempts')
    .insert(insertPayload)
    .select('id')
    .maybeSingle()

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create mock attempt' }, { status: 500 })
  }

  return NextResponse.json({ id: inserted.id })
}

