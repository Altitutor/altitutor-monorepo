import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  openAiImageToBuffer,
  resolveImageApiConfig,
  uploadGeneratedUcatImage,
} from '@/app/api/ucat/authoring-agent/images/lib'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const formData = await request.formData()
    const prompt = formData.get('prompt')
    const image = formData.get('image')
    const alt = formData.get('alt')

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }
    if (!(image instanceof File) || !image.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }

    const config = resolveImageApiConfig()
    const upstream = new FormData()
    upstream.set('model', config.model)
    upstream.set('prompt', prompt)
    upstream.set('image', image)

    const response = await fetch(`${config.baseUrl}/images/edits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: upstream,
    })

    const bytes = await openAiImageToBuffer(response)
    const uploaded = await uploadGeneratedUcatImage({
      bytes,
      mimeType: 'image/png',
      filename: 'ucat-ai-image-edit.png',
      sourcePrompt: prompt,
    })

    return NextResponse.json({
      ...uploaded,
      alt: typeof alt === 'string' && alt.trim() ? alt : prompt.slice(0, 160),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image edit failed' },
      { status: 400 },
    )
  }
}
