import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { callUcatAiJson } from '@/features/ucat/shared/server/ucat-ai-client'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import {
  LessonAiBlockSchema,
  LessonAiModuleSchema,
  LessonAiRichTextResponseSchema,
  buildLessonAiContext,
  lessonAiRichTextToProseMirror,
  metadataToJson,
} from '@/features/ucat/learning-modules/lib/lesson-ai'

const RewriteTextBodySchema = z.object({
  module: LessonAiModuleSchema,
  blocks: z.array(LessonAiBlockSchema).max(80),
  selectedBlockId: z.string().min(1),
  rewriteInstruction: z.string().trim().max(1200).nullable().optional(),
  modelProfileId: z.string().uuid().nullable().optional(),
})

function selectedText(blocks: Array<z.infer<typeof LessonAiBlockSchema>>, selectedBlockId: string): string {
  const block = blocks.find((item) => item.clientId === selectedBlockId)
  if (!block || block.block_type !== 'text') return ''
  return proseMirrorToPlainText((block.content.body ?? null) as Json) ?? ''
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  let body: z.infer<typeof RewriteTextBodySchema>
  try {
    body = RewriteTextBodySchema.parse(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid lesson text rewrite payload', details: error instanceof Error ? error.message : undefined },
      { status: 400 }
    )
  }

  const originalText = selectedText(body.blocks, body.selectedBlockId)
  if (!originalText.trim()) {
    return NextResponse.json(
      { error: 'Select a text block with content before rewriting.' },
      { status: 400 }
    )
  }

  try {
    const client = access.userClient as unknown as SupabaseClient<Database>
    const selectedIndex = body.blocks.findIndex((block) => block.clientId === body.selectedBlockId)
    const lessonContext = await buildLessonAiContext({
      client,
      module: body.module,
      blocks: body.blocks,
      targetIndex: selectedIndex >= 0 ? selectedIndex : null,
      selectedBlockId: body.selectedBlockId,
    })

    const systemPrompt = [
      'You rewrite one UCAT learning module text block for an expert tutor to review.',
      'Return only JSON matching the requested schema.',
      'Preserve the original meaning, learning objective, sequence role, and factual claims.',
      'Substantially reduce source-text similarity and avoid close paraphrase.',
      'Use lesson context only to preserve continuity; do not change the taught concept or introduce unsupported facts.',
      'Use rich text structure when it improves teaching: paragraphs, headings, bullet lists, ordered lists, and tables.',
      'For inline emphasis, use markdown markers like **bold** and _italic_; do not emit HTML tags.',
      'Use tables only when they clarify relationships, steps, comparisons, or common errors.',
    ].join('\n')

    const userPrompt = JSON.stringify(
      {
        task: 'Rewrite the selected learning module text block.',
        originalText,
        rewriteInstruction: body.rewriteInstruction ?? null,
        lessonContext,
        requirements: [
          'Preserve meaning and factual claims.',
          'Reduce source similarity.',
          'Keep the result student-facing and suitable for the same place in the lesson.',
          'If the optional instruction conflicts with preservation of meaning, ignore the conflicting part.',
        ],
        outputShape: {
          blocks: [
            { type: 'paragraph', text: 'rewritten student-facing text' },
            {
              type: 'table',
              rows: [
                ['Header 1', 'Header 2'],
                ['Cell 1', 'Cell 2'],
              ],
            },
          ],
          summary: 'brief tutor-facing summary of what changed',
        },
      },
      null,
      2
    )

    const raw = await callUcatAiJson({
      client,
      operation: 'lesson_text_rewrite',
      modelProfileId: body.modelProfileId ?? null,
      systemPrompt,
      userPrompt,
      temperature: 0.25,
      metadata: metadataToJson({
        moduleId: body.module.moduleId ?? null,
        selectedBlockId: body.selectedBlockId,
        selectedIndex,
      }),
    })

    const parse = LessonAiRichTextResponseSchema.safeParse(raw.parsed)
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Lesson text rewrite output schema mismatch', details: parse.error.flatten() },
        { status: 500 }
      )
    }

    return NextResponse.json({
      body: lessonAiRichTextToProseMirror(parse.data),
      originalText,
      summary: parse.data.summary ?? null,
      metadata: {
        source: 'lesson-ai',
        operation: 'lesson_text_rewrite',
        generatedAt: new Date().toISOString(),
        rewriteInstruction: body.rewriteInstruction ?? null,
        selectedBlockId: body.selectedBlockId,
        modelProfileId: raw.modelProfileId,
        providerId: raw.providerId,
        model: raw.model,
      } satisfies Record<string, Json | string | number | null>,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lesson text rewrite failed' },
      { status: 500 }
    )
  }
}
