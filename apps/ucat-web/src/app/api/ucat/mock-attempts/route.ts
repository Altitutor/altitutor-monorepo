import { NextRequest, NextResponse } from 'next/server'
import type { TablesInsert } from '@altitutor/shared'
import { getSupabaseServerClient } from '@/lib/supabase/server'

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

  const body = (await request.json()) as {
    mockId: string
  }

  if (!body.mockId) {
    return NextResponse.json({ error: 'Missing mockId' }, { status: 400 })
  }

  const insertPayload: MockAttemptInsert = {
    student_id: user.id,
    ucat_mock_id: body.mockId,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('student_ucat_mock_attempts')
    .insert(insertPayload)
    .select('id')
    .maybeSingle()

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to create mock attempt' }, { status: 500 })
  }

  return NextResponse.json({ id: inserted.id })
}

