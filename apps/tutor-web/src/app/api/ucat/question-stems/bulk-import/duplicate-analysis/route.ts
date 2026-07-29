import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  analyzeBulkImportDuplicatesFromCatalog,
  type BulkImportDuplicateDraft,
} from '@/features/ucat/questions/server/bulk-import-duplicate-analysis'

const OptionSchema = z.object({
  id: z.string().optional(),
  answerText: z.unknown(),
  answerExplanation: z.unknown().optional(),
  isAnswer: z.boolean(),
})

const QuestionSchema = z.object({
  id: z.string().optional(),
  questionText: z.unknown(),
  questionType: z.enum(['multiple_choice', 'syllogism']),
  answerExplanation: z.unknown().optional(),
  options: z.array(OptionSchema).max(20),
})

const DraftSchema = z.object({
  id: z.string().min(1).max(200),
  sectionId: z.string().uuid(),
  stemText: z.unknown(),
  questions: z.array(QuestionSchema).min(1).max(20),
})

const BodySchema = z.object({
  drafts: z.array(DraftSchema).min(1).max(200),
})

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const body = BodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json(
      { error: 'Invalid bulk import duplicate-analysis payload' },
      { status: 400 },
    )
  }

  try {
    const client = access.userClient as unknown as SupabaseClient<Database>
    const findings = await analyzeBulkImportDuplicatesFromCatalog(
      client,
      body.data.drafts as BulkImportDuplicateDraft[],
    )
    return NextResponse.json(
      { findings },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to analyse bulk import duplicates',
      },
      { status: 500 },
    )
  }
}
