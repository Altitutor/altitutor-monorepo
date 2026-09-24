import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  generateUcatImageBytes,
  resolveImageApiConfig,
  uploadGeneratedUcatImage,
} from '@/app/api/ucat/authoring-agent/images/lib'

const requestSchema = z.object({
  prompt: z.string().min(1),
  alt: z.string().nullable().optional(),
})

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = requestSchema.parse(await request.json())
    const config = resolveImageApiConfig()
    const bytes = await generateUcatImageBytes({
      config,
      prompt: body.prompt,
      size: '1024x1024',
    })
    const uploaded = await uploadGeneratedUcatImage({
      bytes,
      mimeType: 'image/png',
      filename: 'ucat-ai-image.png',
      sourcePrompt: body.prompt,
    })

    return NextResponse.json({
      ...uploaded,
      alt: body.alt ?? body.prompt.slice(0, 160),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 400 },
    )
  }
}
