import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { callUcatAiJson } from '@/features/ucat/shared/server/ucat-ai-client'
import {
  LessonAiBlockSchema,
  LessonAiModuleSchema,
  LessonAiRichTextResponseSchema,
  buildLessonAiContext,
  lessonAiRichTextToProseMirror,
  metadataToJson,
} from '@/features/ucat/learning-modules/lib/lesson-ai'

const GenerateTextBodySchema = z.object({
  module: LessonAiModuleSchema,
  blocks: z.array(LessonAiBlockSchema).max(80),
  teachingIntent: z.string().trim().min(1).max(1200),
  targetIndex: z.number().int().min(0).max(80),
  targetPositionLabel: z.string().trim().max(240).nullable().optional(),
  modelProfileId: z.string().uuid().nullable().optional(),
})

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let body: z.infer<typeof GenerateTextBodySchema>
  try {
    body = GenerateTextBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid lesson text generation payload', details: error instanceof Error ? error.message : undefined },
      { status: 400 }
    )
  }

  try {
    const client = access.userClient as unknown as SupabaseClient<Database>
    const lessonContext = await buildLessonAiContext({
      client,
      module: body.module,
      blocks: body.blocks,
      targetIndex: body.targetIndex,
    })

    const systemPrompt = [
      'You write concise, student-facing UCAT learning module text for an expert tutor to review.',
      'Return only JSON matching the requested schema.',
      'Use the lesson context and target position to make the new block fit the sequence.',
      'Use rich text structure when it improves teaching: paragraphs, headings, bullet lists, ordered lists, and tables.',
      'For inline emphasis, use markdown markers like **bold** and _italic_; do not emit HTML tags.',
      'Use tables only when they clarify relationships, steps, comparisons, or common errors.',
      'Do not invent unsupported facts. Do not mention internal block ids or database ids.',
    ].join('\n')

    const userPrompt = JSON.stringify(
      {
        task: 'Generate one new learning module text block.',
        teachingIntent: body.teachingIntent,
        targetPosition: {
          index: body.targetIndex,
          label: body.targetPositionLabel ?? null,
        },
        lessonContext,
        outputShape: {
          blocks: [
            { type: 'heading', level: 3, text: 'optional short heading' },
            { type: 'paragraph', text: 'student-facing paragraph' },
            { type: 'bulletList', items: ['optional item'] },
            { type: 'orderedList', items: ['optional step'] },
            {
              type: 'table',
              rows: [
                ['Header 1', 'Header 2'],
                ['Cell 1', 'Cell 2'],
              ],
            },
          ],
          summary: 'brief tutor-facing summary of what was generated',
        },
      },
      null,
      2
    )

    const raw = await callUcatAiJson({
      client,
      operation: 'lesson_text_generate',
      modelProfileId: body.modelProfileId ?? null,
      systemPrompt,
      userPrompt,
      temperature: 0.35,
      metadata: metadataToJson({
        moduleId: body.module.moduleId ?? null,
        targetIndex: body.targetIndex,
        blockCount: body.blocks.length,
      }),
    })

    const parse = LessonAiRichTextResponseSchema.safeParse(raw.parsed)
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Lesson text generation output schema mismatch', details: parse.error.flatten() },
        { status: 500 }
      )
    }

    return NextResponse.json({
      body: lessonAiRichTextToProseMirror(parse.data),
      summary: parse.data.summary ?? null,
      metadata: {
        source: 'lesson-ai',
        operation: 'lesson_text_generate',
        generatedAt: new Date().toISOString(),
        teachingIntent: body.teachingIntent,
        targetIndex: body.targetIndex,
        targetPositionLabel: body.targetPositionLabel ?? null,
        modelProfileId: raw.modelProfileId,
        providerId: raw.providerId,
        model: raw.model,
      } satisfies Record<string, Json | string | number | null>,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lesson text generation failed' },
      { status: 500 }
    )
  }
}
