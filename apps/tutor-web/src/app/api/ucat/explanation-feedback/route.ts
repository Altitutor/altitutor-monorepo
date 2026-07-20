import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin'
import { getOpenExplanationFeedback } from '@/features/ucat/reconciliation/server/explanation-feedback'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response
  if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const stemId = request.nextUrl.searchParams.get('stemId')
  if (!stemId || !UUID_PATTERN.test(stemId)) {
    return NextResponse.json({ error: 'A valid stemId is required' }, { status: 400 })
  }

  const { data: questions, error } = await supabaseAdmin
    .from('ucat_questions')
    .select('id')
    .eq('question_stem_id', stemId)
    .is('deleted_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    const feedback = await getOpenExplanationFeedback((questions ?? []).map((question) => question.id))
    return NextResponse.json({ feedback })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load explanation feedback' },
      { status: 500 },
    )
  }
}
