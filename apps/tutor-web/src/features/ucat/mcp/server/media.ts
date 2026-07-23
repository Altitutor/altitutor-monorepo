import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
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
    attachment: {
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
    attachment: {
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
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from('vtutor_files')
    .select('id,filename,mimetype,size_bytes,bucket,storage_path,external_url,metadata,created_at')
    .eq('id', fileId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('File not found')

  let signedUrl: string | null = null
  if (data.bucket && data.storage_path) {
    const signed = await getServiceRoleClient().storage
      .from(data.bucket)
      .createSignedUrl(data.storage_path, 3600)
    if (signed.error) throw new Error(signed.error.message)
    signedUrl = signed.data.signedUrl
  }
  return {
    ...data,
    signedUrl,
  }
}

