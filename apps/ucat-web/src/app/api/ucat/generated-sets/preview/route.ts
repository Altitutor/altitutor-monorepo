import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { countMatchingQuestions } from '../count-matching'
import type { SetGeneratorInput } from '@/features/set-generator/model/types'

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

  let body: { input?: SetGeneratorInput }
  try {
    body = (await request.json()) as { input?: SetGeneratorInput }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const input = body.input

  if (!input?.section) {
    return NextResponse.json({ error: 'A section must be selected.' }, { status: 400 })
  }

  const { totalMatchingQuestions } = await countMatchingQuestions(supabase, input)

  return NextResponse.json({ totalMatchingQuestions })
}
