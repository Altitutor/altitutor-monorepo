import { renderToBuffer } from '@react-pdf/renderer'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import {
  applySignedUrlsToDoc,
  collectUcatImageRefsFromDoc,
} from '@/features/ucat/question-engine-preview/lib/refresh-ucat-image-urls'
import {
  UcatQuestionExportDocument,
  type UcatPdfGroup,
  type UcatPdfStem,
} from '@/features/ucat/shared/pdf/UcatQuestionExportDocument'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { simplifyPdfGroups } from '@/features/ucat/shared/pdf/simplify-content'
import { embedPdfImageSource } from '@/features/ucat/shared/pdf/image-sources'

export const runtime = 'nodejs'

const OptionsSchema = z.object({
  includeAnswers: z.boolean(),
  repeatStems: z.boolean(),
  avoidQuestionPageBreaks: z.boolean().default(true),
})

const BodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('set'),
    title: z.string().trim().min(1).max(200),
    stemIds: z.array(z.string().uuid()).min(1).max(500),
    options: OptionsSchema,
  }),
  z.object({
    kind: z.literal('mock'),
    title: z.string().trim().min(1).max(200),
    setIds: z.array(z.string().uuid()).min(1).max(50),
    options: OptionsSchema,
  }),
])

type SetDetail = {
  id: string
  name: Json | null
  stems: Array<{ stem_id: string }> | null
}

function safeFilename(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'ucat-export'}.pdf`
}

function asRichDoc(value: Json | null): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function collectRichDocuments(stems: UcatPdfStem[]) {
  return stems
    .flatMap((stem) => [
      stem.stem_text,
      ...stem.questions.flatMap((question) => [
        question.question_text,
        question.answer_explanation,
        ...question.answer_options.flatMap((option) => [option.answer_text, option.answer_explanation]),
      ]),
    ])
    .filter((value): value is Json => value != null)
}

function collectInlineImageSources(documents: Json[]) {
  const sources = new Set<string>()
  function walk(node: Record<string, unknown>) {
    if (node.type === 'image' && node.attrs && typeof node.attrs === 'object') {
      const src = (node.attrs as Record<string, unknown>).src
      if (typeof src === 'string' && src.startsWith('data:image/')) sources.add(src)
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        if (child && typeof child === 'object' && !Array.isArray(child)) walk(child as Record<string, unknown>)
      }
    }
  }
  for (const value of documents) {
    const doc = asRichDoc(value)
    if (doc) walk(doc)
  }
  return sources
}

function applyEmbeddedSources(doc: Record<string, unknown>, sourceMap: Map<string, string>) {
  const result = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>
  function walk(node: Record<string, unknown>) {
    if (node.type === 'image' && node.attrs && typeof node.attrs === 'object') {
      const attrs = node.attrs as Record<string, unknown>
      if (typeof attrs.src === 'string') attrs.src = sourceMap.get(attrs.src) ?? attrs.src
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        if (child && typeof child === 'object' && !Array.isArray(child)) walk(child as Record<string, unknown>)
      }
    }
  }
  walk(result)
  return result
}

async function refreshImageUrls(stems: UcatPdfStem[]): Promise<UcatPdfStem[]> {
  const documents = collectRichDocuments(stems)
  const paths = new Set<string>()
  const fileIds = new Set<string>()
  const inlineSources = collectInlineImageSources(documents)

  for (const value of documents) {
    const doc = asRichDoc(value)
    if (!doc) continue
    const refs = collectUcatImageRefsFromDoc(doc)
    refs.paths.forEach((path) => paths.add(path))
    refs.fileIds.forEach((fileId) => fileIds.add(fileId))
  }

  if (paths.size === 0 && fileIds.size === 0 && inlineSources.size === 0) return stems

  const admin = getServiceRoleClient()
  const pathByFileId = new Map<string, string>()
  if (fileIds.size > 0) {
    const { data, error } = await admin
      .from('files')
      .select('id, bucket, storage_path')
      .in('id', [...fileIds])
    if (error) throw error
    for (const file of data ?? []) {
      if (file.bucket === 'ucat-images' && file.storage_path) pathByFileId.set(file.id, file.storage_path)
    }
  }
  const unresolvedFileIds = [...fileIds].filter((fileId) => !pathByFileId.has(fileId))
  if (unresolvedFileIds.length > 0) throw new Error('One or more embedded images are no longer available.')

  const allPaths = [...new Set([...paths, ...pathByFileId.values()])]
  const signedEntries = await Promise.all(
    allPaths.map(async (path) => {
      const { data, error } = await admin.storage.from('ucat-images').createSignedUrl(path, 900)
      if (error || !data?.signedUrl) throw error ?? new Error('Could not load an embedded image.')
      return [path, await embedPdfImageSource(data.signedUrl)] as const
    }),
  )
  const pathToUrl = new Map(signedEntries)
  const fileIdToUrl = new Map(
    [...pathByFileId].flatMap(([fileId, path]) => {
      const url = pathToUrl.get(path)
      return url ? [[fileId, url] as const] : []
    }),
  )
  const inlineEntries = await Promise.all(
    [...inlineSources].map(async (source) => [source, await embedPdfImageSource(source)] as const),
  )
  const inlineSourceMap = new Map(inlineEntries)

  const refresh = (value: Json | null): Json | null => {
    const doc = asRichDoc(value)
    if (!doc) return value
    const withStoredImages = applySignedUrlsToDoc(doc, pathToUrl, fileIdToUrl)
    return applyEmbeddedSources(withStoredImages, inlineSourceMap) as Json
  }

  return stems.map((stem) => ({
    ...stem,
    stem_text: refresh(stem.stem_text) ?? stem.stem_text,
    questions: stem.questions.map((question) => ({
      ...question,
      question_text: refresh(question.question_text) ?? question.question_text,
      answer_explanation: refresh(question.answer_explanation),
      answer_options: question.answer_options.map((option) => ({
        ...option,
        answer_text: refresh(option.answer_text) ?? option.answer_text,
        answer_explanation: refresh(option.answer_explanation),
      })),
    })),
  }))
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose content to export and try again.' }, { status: 400 })
  }

  const client = access.userClient as unknown as SupabaseClient<Database>
  let requestedGroups: Array<{ id: string; title: string; stemIds: string[] }>

  if (parsed.data.kind === 'set') {
    requestedGroups = [{ id: 'set', title: parsed.data.title, stemIds: parsed.data.stemIds }]
  } else {
    const { data, error } = await client
      .from('vtutor_ucat_question_set_detail')
      .select('id, name, stems')
      .in('id', parsed.data.setIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const detailById = new Map(((data as unknown as SetDetail[] | null) ?? []).map((set) => [set.id, set]))
    if (parsed.data.setIds.some((setId) => !detailById.has(setId))) {
      return NextResponse.json({ error: 'One or more sets in this mock are no longer available.' }, { status: 409 })
    }
    requestedGroups = parsed.data.setIds.map((setId, index) => {
      const set = detailById.get(setId)
      return {
        id: setId,
        title: proseMirrorToPlainText(set?.name ?? null).trim() || `Set ${index + 1}`,
        stemIds: (set?.stems ?? []).map((stem) => stem.stem_id),
      }
    })
  }

  const stemIds = [...new Set(requestedGroups.flatMap((group) => group.stemIds))]
  if (stemIds.length === 0) {
    return NextResponse.json({ error: 'This content does not contain any question stems.' }, { status: 409 })
  }
  if (stemIds.length > 500) {
    return NextResponse.json({ error: 'This export contains too many question stems.' }, { status: 413 })
  }

  const { data: stemData, error: stemError } = await client
    .from('vtutor_ucat_question_stem_detail')
    .select('*')
    .in('id', stemIds)
  if (stemError) return NextResponse.json({ error: stemError.message }, { status: 400 })

  const rawStems = (stemData ?? []) as unknown as UcatPdfStem[]
  const rawStemIds = new Set(rawStems.map((stem) => stem.id))
  if (stemIds.some((stemId) => !rawStemIds.has(stemId))) {
    return NextResponse.json({ error: 'One or more question stems are no longer available.' }, { status: 409 })
  }

  let stems: UcatPdfStem[]
  try {
    stems = await refreshImageUrls(rawStems)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not prepare embedded images for export.' },
      { status: 422 },
    )
  }
  const stemById = new Map(stems.map((stem) => [stem.id, stem]))
  const groups: UcatPdfGroup[] = requestedGroups.map((group) => ({
    id: group.id,
    title: group.title,
    stems: group.stemIds.flatMap((stemId) => {
      const stem = stemById.get(stemId)
      return stem ? [stem] : []
    }),
  }))

  const render = (renderGroups: UcatPdfGroup[], notice?: string) => renderToBuffer(
    <UcatQuestionExportDocument
      title={parsed.data.title}
      groups={renderGroups}
      includeAnswers={parsed.data.options.includeAnswers}
      repeatStems={parsed.data.options.repeatStems}
      avoidQuestionPageBreaks={parsed.data.options.avoidQuestionPageBreaks}
      notice={notice}
    />,
  )

  try {
    let mode: 'rich' | 'simplified' = 'rich'
    let buffer: Buffer
    try {
      buffer = await render(groups)
    } catch {
      mode = 'simplified'
      buffer = await render(
        simplifyPdfGroups(groups, true),
        'Rich formatting was simplified to keep this document printable.',
      )
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${safeFilename(parsed.data.title)}"`,
        'Content-Type': 'application/pdf',
        'X-Altitutor-PDF-Mode': mode,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate PDF',
      },
      { status: 500 },
    )
  }
}
