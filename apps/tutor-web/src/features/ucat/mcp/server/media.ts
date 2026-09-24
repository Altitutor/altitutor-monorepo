import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImageContent } from '@modelcontextprotocol/sdk/types.js'
import sharp from 'sharp'
import {
  editUcatImageBytes,
  generateUcatImageBytes,
  resolveImageApiConfig,
  uploadGeneratedUcatImage,
} from '@/app/api/ucat/authoring-agent/images/lib'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'

type TutorRpcClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

type FileRow = {
  id: string
  filename: string
  mimetype: string
  bucket: string | null
  storage_path: string | null
}

export type UcatMcpFileResult = {
  metadata: Record<string, unknown>
  image?: ImageContent
}

type UcatMcpStorageBucket = {
  createSignedUrl: (
    path: string,
    expiresIn: number,
  ) => Promise<{
    data: { signedUrl: string } | null
    error: { message: string } | null
  }>
  download: (
    path: string,
  ) => Promise<{
    data: Blob | null
    error: { message: string } | null
  }>
}

export type UcatMcpStorageFactory = (bucket: string) => UcatMcpStorageBucket

const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_SOURCE_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000
const MAX_PREVIEW_DIMENSION = 1600
const INLINE_RASTER_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

async function createMcpImageContent(
  source: Blob | Buffer,
  mimeType: string,
): Promise<ImageContent> {
  const bytes = Buffer.isBuffer(source)
    ? source
    : Buffer.from(await source.arrayBuffer())
  if (bytes.length > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('The selected image is too large to prepare for model inspection')
  }

  const image = sharp(bytes, {
    animated: false,
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
  const metadata = await image.metadata()
  if (!metadata.format || !metadata.width || !metadata.height) {
    throw new Error('The selected file is not a readable image')
  }

  if (
    INLINE_RASTER_MIME_TYPES.has(mimeType)
    && bytes.length <= MAX_INLINE_IMAGE_BYTES
    && metadata.width <= MAX_PREVIEW_DIMENSION
    && metadata.height <= MAX_PREVIEW_DIMENSION
  ) {
    return {
      type: 'image',
      data: bytes.toString('base64'),
      mimeType,
    }
  }

  for (const dimension of [MAX_PREVIEW_DIMENSION, 1280, 1024]) {
    for (const quality of [85, 70, 55]) {
      const preview = await image
        .clone()
        .rotate()
        .resize({
          width: dimension,
          height: dimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer()
      if (preview.length <= MAX_INLINE_IMAGE_BYTES) {
        return {
          type: 'image',
          data: preview.toString('base64'),
          mimeType: 'image/webp',
        }
      }
    }
  }

  throw new Error('The selected image could not be reduced to a safe MCP preview size')
}

export async function createMcpImageContentFromDataUri(
  dataUri: string,
): Promise<ImageContent> {
  const match = /^data:([^;,]+)(?:;charset=[^;,]+)?(;base64)?,([\s\S]*)$/u.exec(dataUri)
  if (!match?.[1] || match[3] === undefined || !match[1].startsWith('image/')) {
    throw new Error('The rendered visual did not produce a valid image data URI')
  }
  const source = match[2]
    ? Buffer.from(match[3], 'base64')
    : Buffer.from(decodeURIComponent(match[3]), 'utf8')
  if (source.length > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('The rendered visual is too large to prepare for model inspection')
  }
  const png = await sharp(source, {
    limitInputPixels: MAX_IMAGE_PIXELS,
    density: 144,
  })
    .resize({
      width: MAX_PREVIEW_DIMENSION,
      height: MAX_PREVIEW_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9 })
    .toBuffer()
  if (png.length <= MAX_INLINE_IMAGE_BYTES) {
    return {
      type: 'image',
      data: png.toString('base64'),
      mimeType: 'image/png',
    }
  }
  return createMcpImageContent(png, 'image/png')
}

async function currentTutorId(client: SupabaseClient<Database>): Promise<string> {
  const { data, error } = await (client as unknown as TutorRpcClient).rpc('current_tutor_id')
  if (error || typeof data !== 'string') throw new Error('Tutor profile not found')
  return data
}

export async function generateUcatMcpImage(
  client: SupabaseClient<Database>,
  input: { prompt: string; alt?: string | null },
): Promise<Record<string, unknown>> {
  const tutorId = await currentTutorId(client)
  const bytes = await generateUcatImageBytes({
    config: resolveImageApiConfig(),
    prompt: input.prompt,
    size: '1024x1024',
  })
  const uploaded = await uploadGeneratedUcatImage({
    bytes,
    mimeType: 'image/png',
    filename: 'ucat-ai-image.png',
    sourcePrompt: input.prompt,
    tutorId,
  })
  return {
    ...uploaded,
    alt: input.alt?.trim() || input.prompt.slice(0, 160),
    imageNode: {
      type: 'image',
      attrs: {
        src: uploaded.signedUrl,
        alt: input.alt?.trim() || input.prompt.slice(0, 160),
        fileId: uploaded.fileId,
      },
    },
  }
}

export async function reviseUcatMcpImage(
  client: SupabaseClient<Database>,
  input: {
    fileId: string
    instructions: string
    alt?: string | null
    context?: unknown
  },
): Promise<Record<string, unknown>> {
  const tutorId = await currentTutorId(client)
  const fileResult = await client
    .from('vtutor_files')
    .select('id,filename,mimetype,bucket,storage_path')
    .eq('id', input.fileId)
    .maybeSingle()
  if (fileResult.error || !fileResult.data) {
    throw new Error('The selected image is no longer available')
  }
  const file = fileResult.data as unknown as FileRow
  if (!file.bucket || !file.storage_path || !file.mimetype.startsWith('image/')) {
    throw new Error('The selected file is not a stored image')
  }

  const service = getServiceRoleClient()
  const { data: sourceBlob, error: downloadError } = await service.storage
    .from(file.bucket)
    .download(file.storage_path)
  if (downloadError || !sourceBlob) throw new Error('Failed to load the selected image')
  if (sourceBlob.size > 50 * 1024 * 1024) throw new Error('The selected image is too large to revise')

  const context = input.context === undefined
    ? ''
    : JSON.stringify(input.context, null, 2).slice(0, 30_000)
  const prompt = [
    'Revise the supplied UCAT authoring image according to the instructions.',
    'Preserve content that was not requested to change, especially numerical values, labels, axes, legends, spatial relationships, and answer-relevant details.',
    'Keep a clean exam-source style with readable text and no watermarks, explanations, or answer hints.',
    '',
    `Instructions: ${input.instructions}`,
    context ? `\nAuthoring context:\n${context}` : '',
  ].join('\n')
  const bytes = await editUcatImageBytes({
    config: resolveImageApiConfig(),
    prompt,
    image: sourceBlob,
    filename: file.filename,
    size: 'auto',
    openaiImageField: 'image[]',
  })
  const uploaded = await uploadGeneratedUcatImage({
    bytes,
    mimeType: 'image/png',
    filename: 'ucat-ai-image-revision.png',
    sourcePrompt: prompt,
    tutorId,
  })
  const alt = input.alt?.trim() || `AI revision: ${input.instructions.slice(0, 160)}`
  return {
    ...uploaded,
    alt,
    imageNode: {
      type: 'image',
      attrs: {
        src: uploaded.signedUrl,
        alt,
        fileId: uploaded.fileId,
      },
    },
  }
}

export async function getUcatMcpFile(
  client: SupabaseClient<Database>,
  fileId: string,
  storageForBucket?: UcatMcpStorageFactory,
): Promise<UcatMcpFileResult> {
  const { data, error } = await client
    .from('vtutor_files')
    .select('id,filename,mimetype,size_bytes,bucket,storage_path,external_url,metadata,created_at')
    .eq('id', fileId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('File not found')

  let signedUrl: string | null = null
  let image: ImageContent | undefined
  if (data.bucket && data.storage_path) {
    const storage = storageForBucket
      ? storageForBucket(data.bucket)
      : getServiceRoleClient().storage.from(data.bucket)
    const signed = await storage.createSignedUrl(data.storage_path, 3600)
    if (signed.error || !signed.data) {
      throw new Error(signed.error?.message ?? 'Failed to create a signed file URL')
    }
    signedUrl = signed.data.signedUrl
    if (typeof data.mimetype === 'string' && data.mimetype.startsWith('image/')) {
      const downloaded = await storage.download(data.storage_path)
      if (downloaded.error || !downloaded.data) {
        throw new Error(downloaded.error?.message ?? 'Failed to load the selected image')
      }
      image = await createMcpImageContent(downloaded.data, data.mimetype)
    }
  }
  return {
    metadata: {
      ...data,
      signedUrl,
    },
    ...(image ? { image } : {}),
  }
}
