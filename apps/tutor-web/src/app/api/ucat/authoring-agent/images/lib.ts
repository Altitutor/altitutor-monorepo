import type { TablesInsert } from '@altitutor/shared'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { createClient } from '@/shared/lib/supabase/server-ssr'

const BUCKET = 'ucat-images'
const SIGNED_URL_EXPIRY_SECONDS = 3600

export async function uploadGeneratedUcatImage(params: {
  bytes: Buffer
  mimeType: string
  filename: string
  sourcePrompt: string
}) {
  const userClient = createClient()
  const { data: tutorId, error: tutorIdError } = await userClient.rpc('current_tutor_id')
  if (tutorIdError || !tutorId) {
    throw new Error('Failed to resolve tutor')
  }

  const service = getServiceRoleClient()
  const timestamp = Date.now()
  const safeFilename = params.filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storagePath = `generated/${tutorId}/${timestamp}_${crypto.randomUUID().slice(0, 8)}_${safeFilename}`

  const { data: uploadData, error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(storagePath, params.bytes, {
      cacheControl: '3600',
      upsert: false,
      contentType: params.mimeType,
    })

  if (uploadError || !uploadData) {
    throw new Error(uploadError?.message ?? 'Failed to upload generated image')
  }

  const fileInsert: TablesInsert<'files'> = {
    mimetype: params.mimeType,
    filename: params.filename,
    size_bytes: params.bytes.length,
    metadata: {
      originalName: params.filename,
      uploadedAt: new Date().toISOString(),
      source: 'ucat-ai-image-generation',
      prompt: params.sourcePrompt,
    },
    storage_provider: 'supabase',
    bucket: BUCKET,
    storage_path: uploadData.path,
    created_by: tutorId,
  }

  const { data: fileRow, error: fileError } = await service
    .from('files')
    .insert(fileInsert)
    .select('id')
    .single()

  if (fileError || !fileRow) {
    await service.storage.from(BUCKET).remove([uploadData.path])
    throw new Error(fileError?.message ?? 'Failed to create generated image file row')
  }

  const { data: signed, error: signedError } = await service.storage
    .from(BUCKET)
    .createSignedUrl(uploadData.path, SIGNED_URL_EXPIRY_SECONDS)

  if (signedError || !signed?.signedUrl) {
    throw new Error(signedError?.message ?? 'Failed to create signed URL')
  }

  return {
    fileId: fileRow.id,
    storagePath: uploadData.path,
    signedUrl: signed.signedUrl,
  }
}

export function resolveImageApiConfig() {
  const apiKey = process.env.UCAT_IMAGE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('UCAT image generation is not configured')
  return {
    apiKey,
    model: process.env.UCAT_IMAGE_MODEL || 'gpt-image-1',
    baseUrl: (process.env.UCAT_IMAGE_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/u, ''),
  }
}

export async function openAiImageToBuffer(response: Response): Promise<Buffer> {
  if (!response.ok) {
    throw new Error(`Image generation failed: ${await response.text()}`)
  }
  const json = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> }
  const first = json.data?.[0]
  if (first?.b64_json) return Buffer.from(first.b64_json, 'base64')
  if (first?.url) {
    const imageResponse = await fetch(first.url)
    if (!imageResponse.ok) throw new Error('Failed to download generated image')
    return Buffer.from(await imageResponse.arrayBuffer())
  }
  throw new Error('Image generation returned no image')
}
