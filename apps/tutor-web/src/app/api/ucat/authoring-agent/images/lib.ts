import type { TablesInsert } from '@altitutor/shared'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { createClient } from '@/shared/lib/supabase/server-ssr'

const BUCKET = 'ucat-images'
const SIGNED_URL_EXPIRY_SECONDS = 3600

const OPENAI_IMAGE_BASE_URL = 'https://api.openai.com/v1'
const OPENROUTER_IMAGE_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2'
const DEFAULT_OPENROUTER_IMAGE_MODEL = 'openai/gpt-image-2'

export type UcatImageProvider = 'openai' | 'openrouter'

export type UcatImageApiConfig = {
  provider: UcatImageProvider
  apiKey: string
  model: string
  editModel: string
  baseUrl: string
  headers: Record<string, string>
}

export async function uploadGeneratedUcatImage(params: {
  bytes: Buffer
  mimeType: string
  filename: string
  sourcePrompt: string
  tutorId?: string
}) {
  let tutorId = params.tutorId
  if (!tutorId) {
    const userClient = createClient()
    const { data, error } = await userClient.rpc('current_tutor_id')
    if (error || !data) {
      throw new Error('Failed to resolve tutor')
    }
    tutorId = data
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

function openRouterDefaultHeaders(): Record<string, string> {
  return {
    'HTTP-Referer': process.env.NEXT_PUBLIC_TUTOR_URL || 'https://altitutor.com',
    'X-Title': 'Altitutor UCAT image generation',
  }
}

function withAuthHeaders(config: UcatImageApiConfig, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${config.apiKey}`,
    ...config.headers,
    ...extra,
  }
}

/**
 * Key resolution: dedicated image OpenAI key → OPENAI_API_KEY → OPENROUTER_API_KEY.
 * Model stays env-only (no tutor UI); defaults differ per provider.
 */
export function resolveImageApiConfig(): UcatImageApiConfig {
  const dedicatedOpenAiKey = process.env.UCAT_IMAGE_OPENAI_API_KEY
  const openAiKey = dedicatedOpenAiKey || process.env.OPENAI_API_KEY
  if (openAiKey) {
    const model = process.env.UCAT_IMAGE_MODEL || DEFAULT_OPENAI_IMAGE_MODEL
    return {
      provider: 'openai',
      apiKey: openAiKey,
      model,
      editModel: process.env.UCAT_IMAGE_EDIT_MODEL || model,
      baseUrl: (process.env.UCAT_IMAGE_OPENAI_BASE_URL || OPENAI_IMAGE_BASE_URL).replace(/\/$/u, ''),
      headers: {},
    }
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY
  if (openRouterKey) {
    const model = process.env.UCAT_IMAGE_MODEL || DEFAULT_OPENROUTER_IMAGE_MODEL
    return {
      provider: 'openrouter',
      apiKey: openRouterKey,
      model,
      editModel: process.env.UCAT_IMAGE_EDIT_MODEL || model,
      baseUrl: (process.env.UCAT_IMAGE_OPENROUTER_BASE_URL || OPENROUTER_IMAGE_BASE_URL).replace(/\/$/u, ''),
      headers: openRouterDefaultHeaders(),
    }
  }

  throw new Error(
    'UCAT image generation is not configured. Set UCAT_IMAGE_OPENAI_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY.',
  )
}

export function isOpenRouterImageBaseUrl(baseUrl: string): boolean {
  return baseUrl.includes('openrouter.ai')
}

export function imageConfigFromProvider(params: {
  apiKey: string
  baseUrl: string
  providerKey: string
}): UcatImageApiConfig {
  const baseUrl = params.baseUrl.replace(/\/$/u, '')
  if (params.providerKey === 'openrouter' || isOpenRouterImageBaseUrl(baseUrl)) {
    const model = process.env.UCAT_IMAGE_MODEL || DEFAULT_OPENROUTER_IMAGE_MODEL
    return {
      provider: 'openrouter',
      apiKey: params.apiKey,
      model,
      editModel: process.env.UCAT_IMAGE_EDIT_MODEL || model,
      baseUrl,
      headers: openRouterDefaultHeaders(),
    }
  }

  const model = process.env.UCAT_IMAGE_MODEL || DEFAULT_OPENAI_IMAGE_MODEL
  return {
    provider: 'openai',
    apiKey: params.apiKey,
    model,
    editModel: process.env.UCAT_IMAGE_EDIT_MODEL || model,
    baseUrl,
    headers: {},
  }
}

export async function openAiImageToBuffer(response: Response): Promise<Buffer> {
  if (!response.ok) {
    throw new Error(`Image generation failed: ${await response.text()}`)
  }
  const json = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string; media_type?: string }>
  }
  const first = json.data?.[0]
  if (first?.b64_json) return Buffer.from(first.b64_json, 'base64')
  if (first?.url) {
    const imageResponse = await fetch(first.url)
    if (!imageResponse.ok) throw new Error('Failed to download generated image')
    return Buffer.from(await imageResponse.arrayBuffer())
  }
  throw new Error('Image generation returned no image')
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer())
  const mimeType = blob.type || 'image/png'
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

function usesOpenAiImagesGenerationsApi(model: string): boolean {
  return model.startsWith('gpt-image') || model.startsWith('dall-e') || model.includes('/gpt-image') || model.includes('/dall-e')
}

export async function generateUcatImageBytes(params: {
  config: UcatImageApiConfig
  prompt: string
  size?: string
}): Promise<Buffer> {
  const size = params.size || '1024x1024'

  if (params.config.provider === 'openrouter') {
    const response = await fetch(`${params.config.baseUrl}/images`, {
      method: 'POST',
      headers: withAuthHeaders(params.config, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        model: params.config.model,
        prompt: params.prompt,
        size,
        output_format: 'png',
      }),
    })
    return openAiImageToBuffer(response)
  }

  if (usesOpenAiImagesGenerationsApi(params.config.model)) {
    const response = await fetch(`${params.config.baseUrl}/images/generations`, {
      method: 'POST',
      headers: withAuthHeaders(params.config, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        model: params.config.model,
        prompt: params.prompt,
        size,
      }),
    })
    return openAiImageToBuffer(response)
  }

  const response = await fetch(`${params.config.baseUrl}/responses`, {
    method: 'POST',
    headers: withAuthHeaders(params.config, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      model: params.config.model,
      input: params.prompt,
      tools: [{ type: 'image_generation', action: 'generate', size }],
    }),
  })
  if (!response.ok) {
    throw new Error(`Image generation failed: ${await response.text()}`)
  }
  const json = (await response.json()) as { output?: Array<{ type?: string; result?: string }> }
  const image = json.output?.find((item) => item.type === 'image_generation_call' && typeof item.result === 'string')
  if (!image?.result) throw new Error('Image generation returned no image')
  return Buffer.from(image.result, 'base64')
}

export async function editUcatImageBytes(params: {
  config: UcatImageApiConfig
  prompt: string
  image: Blob
  filename?: string
  size?: string
  openaiImageField?: 'image' | 'image[]'
}): Promise<Buffer> {
  const model = params.config.editModel

  if (params.config.provider === 'openrouter') {
    const response = await fetch(`${params.config.baseUrl}/images`, {
      method: 'POST',
      headers: withAuthHeaders(params.config, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        model,
        prompt: params.prompt,
        size: params.size || '1024x1024',
        output_format: 'png',
        input_references: [
          {
            type: 'image_url',
            image_url: {
              url: await blobToDataUrl(params.image),
            },
          },
        ],
      }),
    })
    return openAiImageToBuffer(response)
  }

  const formData = new FormData()
  formData.set('model', model)
  formData.set('prompt', params.prompt)
  formData.set(params.openaiImageField ?? 'image', params.image, params.filename || 'source.png')
  if (params.size) formData.set('size', params.size)

  const response = await fetch(`${params.config.baseUrl}/images/edits`, {
    method: 'POST',
    headers: withAuthHeaders(params.config),
    body: formData,
  })
  return openAiImageToBuffer(response)
}
