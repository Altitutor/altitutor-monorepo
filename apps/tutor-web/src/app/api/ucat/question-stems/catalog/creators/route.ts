import { NextResponse } from 'next/server'
import { captureApiErrorResponse } from '@/lib/sentry/capture-api-error'
import {
  requireUcatTutor,
  type UcatTutorSupabaseClient,
} from '@/features/ucat/shared/server/guard'

export async function GET() {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const client = access.userClient as unknown as UcatTutorSupabaseClient
  const { data, error } = await client.rpc('tutor_ucat_question_catalog_creators')
  if (error) {
    return captureApiErrorResponse(
      error,
      '/api/ucat/question-stems/catalog/creators',
      NextResponse.json({ error: error.message }, { status: 500 }),
    )
  }

  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}
