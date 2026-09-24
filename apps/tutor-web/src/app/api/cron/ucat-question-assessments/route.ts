import { NextResponse } from 'next/server'
import { recoverQueuedUcatQuestionAssessments } from '@/features/ucat/questions/server/ai-assessment/dispatcher'

export const maxDuration = 60

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorised = process.env.NODE_ENV === 'development'
    || Boolean(cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`)
  if (!authorised) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dispatched = await recoverQueuedUcatQuestionAssessments()
  return NextResponse.json({ ok: true, dispatched })
}
