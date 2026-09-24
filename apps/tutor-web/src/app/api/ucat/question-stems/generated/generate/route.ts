import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { GenerateBodySchema } from '@/features/ucat/questions/server/generate-question-stems'
import { startUcatQuestionGeneration } from '@/features/ucat/questions/server/start-question-generation'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const parsed = GenerateBodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid generation payload', details: parsed.error.message },
      { status: 400 },
    )
  }

  const body = parsed.data
  const client = access.userClient as unknown as SupabaseClient<Database>

  try {
    return NextResponse.json(
      await startUcatQuestionGeneration(client, body),
      { status: 202 },
    )
  } catch (error) {
    captureApiError(error, "/api/ucat/question-stems/generated/generate");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to start generation' },
      { status: 500 },
    )
  }
}
