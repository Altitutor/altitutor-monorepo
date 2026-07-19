import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UcatAiUserContentPart } from '@/features/ucat/shared/server/ucat-ai-client'
import type {
  UcatAssessmentImage,
  UcatAssessmentSnapshot,
} from '@/features/ucat/questions/lib/ai-assessment/schema'

type EvidenceAvailability = {
  label: string
  inspectable: boolean
  renderedStudentWidth: number | null
  error: string | null
}

type SupabaseAny = SupabaseClient<Database> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

function dataUri(bytes: Buffer, mimeType = 'image/png'): string {
  return `data:${mimeType};base64,${bytes.toString('base64')}`
}

function parseDataUri(value: string): { bytes: Buffer; mimeType: string } | null {
  const match = value.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/iu)
  if (!match) return null
  try {
    return {
      mimeType: match[1] || 'application/octet-stream',
      bytes: match[2] ? Buffer.from(match[3] ?? '', 'base64') : Buffer.from(decodeURIComponent(match[3] ?? '')),
    }
  } catch {
    return null
  }
}

function evidenceImages(
  snapshot: UcatAssessmentSnapshot,
  targetQuestionIds: Set<string>,
  includeExplanations: boolean,
): UcatAssessmentImage[] {
  const values = [
    ...snapshot.images,
    ...snapshot.questions
      .filter((question) => targetQuestionIds.has(question.id))
      .flatMap((question) => [
        ...question.images.filter((image) => includeExplanations || !image.location.endsWith(':answer_explanation')),
        ...question.options.flatMap((option) => option.images.filter(
          (image) => includeExplanations || !image.location.endsWith(':answer_explanation'),
        )),
      ]),
  ]
  const seen = new Set<string>()
  return values.filter((image) => {
    const key = `${image.location}:${image.index}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 16)
}

async function resolveImageBytes(
  client: SupabaseClient<Database>,
  image: UcatAssessmentImage,
): Promise<Buffer> {
  if (image.src?.startsWith('data:')) {
    const parsed = parseDataUri(image.src)
    if (!parsed) throw new Error('Invalid embedded image data')
    return parsed.bytes
  }

  let source = image.src
  let bucket = 'ucat-images'
  let storagePath = image.storagePath
  if (image.fileId && !storagePath) {
    const { data, error } = await (client as SupabaseAny)
      .from('files')
      .select('bucket,storage_path,external_url')
      .eq('id', image.fileId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    bucket = typeof data?.bucket === 'string' ? data.bucket : bucket
    storagePath = typeof data?.storage_path === 'string' ? data.storage_path : null
    source = typeof data?.external_url === 'string' ? data.external_url : source
  }
  if (storagePath) {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(storagePath, 900)
    if (error || !data?.signedUrl) throw error ?? new Error('Could not sign stored image')
    source = data.signedUrl
  }
  if (!source) throw new Error('Image source is missing')
  const response = await fetch(source, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Image returned ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

function expectedStudentWidth(snapshot: UcatAssessmentSnapshot, image: UcatAssessmentImage): number {
  const columnWidth = snapshot.displayColumns >= 2 ? 520 : 900
  return Math.max(240, Math.min(columnWidth, Math.round(image.modelWidth ?? columnWidth)))
}

export async function buildVisualEvidence(params: {
  client: SupabaseClient<Database>
  snapshot: UcatAssessmentSnapshot
  targetQuestionIds: string[]
  includeExplanations?: boolean
}): Promise<{ parts: UcatAiUserContentPart[]; availability: EvidenceAvailability[] }> {
  const images = evidenceImages(
    params.snapshot,
    new Set(params.targetQuestionIds),
    params.includeExplanations ?? false,
  )
  const parts: UcatAiUserContentPart[] = []
  const availability: EvidenceAvailability[] = []
  const { default: sharp } = await import('sharp')

  for (const image of images) {
    const label = `${image.location}:image:${image.index}`
    try {
      const source = await resolveImageBytes(params.client, image)
      const originalPng = await sharp(source, { density: 192 })
        .flatten({ background: '#ffffff' })
        .resize({ width: 1600, withoutEnlargement: true })
        .png()
        .toBuffer()
      const studentWidth = expectedStudentWidth(params.snapshot, image)
      const studentPng = await sharp(source, { density: 96 })
        .flatten({ background: '#ffffff' })
        .resize({ width: studentWidth, withoutEnlargement: false })
        .png()
        .toBuffer()
      parts.push(
        { type: 'text', text: `Original visual asset for ${label}.` },
        { type: 'image', imageUrl: dataUri(originalPng), detail: 'high' },
        { type: 'text', text: `Rendered student-view visual for ${label} at ${studentWidth}px within the UCAT exam layout.` },
        { type: 'image', imageUrl: dataUri(studentPng), detail: 'high' },
      )
      availability.push({ label, inspectable: true, renderedStudentWidth: studentWidth, error: null })
    } catch (error) {
      availability.push({
        label,
        inspectable: false,
        renderedStudentWidth: null,
        error: error instanceof Error ? error.message : 'Image could not be inspected',
      })
    }
  }
  return { parts, availability }
}
