import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { createClient } from '@/shared/lib/supabase/server-ssr'
import {
  openAiImageToBuffer,
  resolveImageApiConfig,
  uploadGeneratedUcatImage,
} from '@/app/api/ucat/authoring-agent/images/lib'

const requestSchema = z.object({
  fileId: z.string().uuid(),
  instructions: z.string().trim().min(1).max(4000),
  alt: z.string().max(1000).nullable().optional(),
  context: z.unknown(),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function richText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(richText).filter(Boolean).join(' ')
  if (!isRecord(value)) return ''
  if (typeof value.text === 'string') return value.text
  const content = Array.isArray(value.content) ? value.content.map(richText).filter(Boolean) : []
  const separator = ['doc', 'paragraph', 'listItem', 'bulletList', 'orderedList'].includes(String(value.type)) ? '\n' : ' '
  return content.join(separator).replace(/\s*\n\s*/gu, '\n').trim()
}

function questionPackageContext(value: unknown): string {
  if (isRecord(value) && Array.isArray(value.questions)) {
    const lines = [`Question stem:\n${richText(value.stemText) || '(no stem text)'}`]
    value.questions.forEach((question, questionIndex) => {
      if (!isRecord(question)) return
      lines.push(`\nQuestion ${questionIndex + 1}:\n${richText(question.questionText) || '(no question text)'}`)
      if (Array.isArray(question.options)) {
        question.options.forEach((option, optionIndex) => {
          if (!isRecord(option)) return
          lines.push(`Option ${optionIndex + 1}${option.isAnswer === true ? ' (correct)' : ''}: ${richText(option.answerText)}`)
        })
      }
      const explanation = richText(question.answerExplanation)
      if (explanation) lines.push(`Answer explanation: ${explanation}`)
    })
    return lines.join('\n').slice(0, 30_000)
  }
  try {
    return JSON.stringify(value, null, 2).slice(0, 30_000)
  } catch {
    return ''
  }
}

function imageExtension(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  return 'png'
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = requestSchema.parse(await request.json())
    const client = createClient()
    const fileResult = await client
      .from('files')
      .select('id,filename,mimetype,bucket,storage_path')
      .eq('id', body.fileId)
      .single()
    const file = fileResult.data as unknown as {
      id: string
      filename: string
      mimetype: string
      bucket: string | null
      storage_path: string | null
    } | null
    const fileError = fileResult.error
    if (fileError || !file?.bucket || !file.storage_path) {
      throw new Error('The selected image is no longer available.')
    }
    if (!file.mimetype?.startsWith('image/')) throw new Error('The selected file is not an image.')

    const { data: sourceBlob, error: downloadError } = await client.storage
      .from(file.bucket)
      .download(file.storage_path)
    if (downloadError || !sourceBlob) throw new Error('Failed to load the selected image.')
    if (sourceBlob.size > 50 * 1024 * 1024) throw new Error('The selected image is too large to revise.')

    const config = resolveImageApiConfig()
    const model = process.env.UCAT_IMAGE_EDIT_MODEL || config.model
    const prompt = [
      'Revise the supplied UCAT question image according to the tutor instructions.',
      'Preserve all content that the tutor did not ask to change, especially numerical values, labels, axes, legends, spatial relationships, and answer-relevant details.',
      'Keep a clean exam-source style with readable text and no decorative additions, watermarks, explanations, or answer hints.',
      '',
      `Tutor instructions: ${body.instructions}`,
      '',
      'Current unsaved question-stem package for context:',
      questionPackageContext(body.context),
    ].join('\n')

    const formData = new FormData()
    formData.set('model', model)
    formData.set('prompt', prompt)
    formData.set('image[]', sourceBlob, file.filename || `source.${imageExtension(file.mimetype)}`)
    formData.set('size', 'auto')
    const response = await fetch(`${config.baseUrl}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: formData,
    })
    const bytes = await openAiImageToBuffer(response)

    const uploaded = await uploadGeneratedUcatImage({
      bytes,
      mimeType: 'image/png',
      filename: 'ucat-ai-image-revision.png',
      sourcePrompt: prompt,
    })
    return NextResponse.json({
      ...uploaded,
      alt: body.alt?.trim() || `AI revision: ${body.instructions.slice(0, 160)}`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image revision failed.' },
      { status: 400 },
    )
  }
}
