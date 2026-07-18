import { z } from 'zod'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  callUcatAiJson,
  getUcatAiPromptLayers,
  resolveUcatAiConfig,
  UcatAiEmptyResponseError,
  UcatAiJsonParseError,
  type UcatAiResolvedConfig,
  type UcatAiUserContentPart,
} from '@/features/ucat/shared/server/ucat-ai-client'
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin'
import { extractUcatImagePathFromSignedUrl, REFRESHED_URL_EXPIRY_SECONDS } from '@/features/ucat/question-engine-preview/lib/refresh-ucat-image-urls'
import {
  buildWriterPrompt,
  type AiGenerationBrief,
} from '@/features/ucat/questions/lib/ai-generation/prompts'
import {
  buildLocalPlan,
} from '@/features/ucat/questions/lib/ai-generation/local-plan'
import {
  DifficultyTargetSchema,
  GeneratedCandidateResponseSchema,
  TimeBurdenTargetSchema,
  type GeneratedContentBlock,
  type GeneratedStem,
} from '@/features/ucat/questions/lib/ai-generation/schema'
import {
  generatedContentToPlainText,
} from '@/features/ucat/questions/lib/ai-generation/content-blocks'
import { generatedContentToProseMirrorServer } from '@/features/ucat/questions/lib/ai-generation/server-content-blocks'
import {
  hasBlockingIssues,
  validateGeneratedStemCandidate,
  type GenerationComparisonSource,
  type GenerationGateIssue,
} from '@/features/ucat/questions/lib/ai-generation/gates'
import { sampleWithoutReplacement } from '@/features/ucat/questions/lib/ai-generation/sample-without-replacement'
import {
  openAiImageToBuffer,
  resolveImageApiConfig,
  uploadGeneratedUcatImage,
} from '@/app/api/ucat/authoring-agent/images/lib'

type SupabaseAny = SupabaseClient<Database> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => any
}

export const GenerateBodySchema = z.object({
  sectionId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  modelProfileId: z.string().uuid().nullable().optional(),
  sourceMode: z.enum(['none', 'random', 'selected']).default('none'),
  includeAiSourceStems: z.boolean().default(false),
  imageGenerationMode: z.enum(['auto', 'deterministic', 'ai']).default('auto'),
  sourceStemIds: z.array(z.string().uuid()).optional(),
  stemCount: z.number().int().min(1).max(50),
  difficultyTarget: DifficultyTargetSchema.default('mixed'),
  timeBurdenTarget: TimeBurdenTargetSchema.default('mixed'),
  targetTagIds: z.array(z.string().uuid()).default([]),
  runInstructions: z.string().trim().max(2000).nullable().optional(),
})

const GENERATION_TOKEN_LIMITS = {
  writer: 3000,
} as const

const GENERATION_TIMEOUT_MS = {
  writer: 75_000,
} as const

const RANDOM_SOURCE_STEM_LIMIT = 300
/** Initial writer call + same-category regenerations after blocking gate / write failure. */
const SAME_CATEGORY_ATTEMPTS = 2
const MAX_SOURCE_IMAGES_FOR_WRITER = 8
const SOURCE_IMAGE_DETAIL: Extract<UcatAiUserContentPart, { type: 'image' }>['detail'] = 'high'
const SOURCE_STEM_DETAIL_SELECT =
  'id,source_channel,question_stem_category_id,category_name,stem_text,questions' as const

export type SourceStem = {
  id: string
  source_channel?: string | null
  question_stem_category_id?: string | null
  category_name?: string | null
  stem_text: Json | null
  questions: Array<{
    question_text?: Json | null
    answer_explanation?: Json | null
    question_type?: 'multiple_choice' | 'syllogism'
    tags?: Array<{ id?: string | null; name?: string | null }> | null
    answer_options?: Array<{
      answer_text?: Json | null
      answer_explanation?: Json | null
      is_answer?: boolean
    }>
  }> | null
}

type SourceImageRef = {
  sourceStemId: string
  field: string
  imageIndex: number
  fileId: string | null
  storagePath: string | null
  src: string | null
  alt: string | null
}

type SourceWriterImage = SourceImageRef & {
  signedUrl: string
}

export type StemCategoryChoice = {
  id: string
  name: string
}

type GenerationDebugCall = {
  stemIndex: number
  categoryName: string | null
  operation: string
  model: string | null
  durationMs: number
  status: 'ok' | 'error'
  error?: string
  request: {
    systemPrompt: string
    userPrompt: string
    userContentPartCount?: number
    sourceImageCount?: number
    sourceImagesForWriter?: Array<Record<string, unknown>>
    maxCompletionTokens: number
    timeoutMs: number
    providerSort: 'throughput'
  }
  response?: {
    content: string
    finishReason: string | null
    usage: unknown
    contentLength: number
    sourceImageFallback?: 'model_rejected_image_input'
  }
  parsedSummary?: {
    stemCount: number
    categories: Array<string | null>
    questionCounts: number[]
  }
}

type GenerationDebugInfo = {
  runId?: string | null
  requestedStemCount: number
  sectionName: string | null
  selectedCategoryName: string | null
  sourceSampleIds: string[]
  sourceImageCount: number
  sourceImagesForWriter: Array<Record<string, unknown>>
  promptLayerCount: number
  calls: GenerationDebugCall[]
  gateIssues: GenerationGateIssue[]
}

export type GenerateBody = z.infer<typeof GenerateBodySchema>

type GenerationProgressEvent = {
  type: 'progress'
  step: 'setup' | 'sources' | 'generating' | 'gates' | 'images' | 'drafts'
  message: string
  completedStems?: number
  totalStems?: number
  runId?: string | null
}

type EmitProgress = (event: GenerationProgressEvent) => void | Promise<void>

type GenerationResult = {
  status: number
  payload: Record<string, unknown>
}

export type GenerationActor = {
  userId: string | null
  name: string | null
  email: string | null
}

export function generationActorFromUser(user: unknown): GenerationActor {
  if (!user || typeof user !== 'object') {
    return { userId: null, name: null, email: null }
  }
  const record = user as {
    id?: unknown
    email?: unknown
    user_metadata?: Record<string, unknown> | null
  }
  const metadata = record.user_metadata ?? {}
  const firstName = typeof metadata.first_name === 'string' ? metadata.first_name : ''
  const lastName = typeof metadata.last_name === 'string' ? metadata.last_name : ''
  const metadataName =
    typeof metadata.full_name === 'string' && metadata.full_name.trim()
      ? metadata.full_name
      : typeof metadata.name === 'string' && metadata.name.trim()
        ? metadata.name
        : [firstName, lastName].filter(Boolean).join(' ')

  return {
    userId: typeof record.id === 'string' ? record.id : null,
    name: metadataName.trim() || null,
    email: typeof record.email === 'string' ? record.email : null,
  }
}

function asAny(client: SupabaseClient<Database>): SupabaseAny {
  return client as SupabaseAny
}

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function extractText(value: Json | null | undefined): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((item) => extractText(item as Json)).filter(Boolean).join(' ').trim()
  const record = value as Record<string, Json>
  if (typeof record.text === 'string') return record.text
  if (Array.isArray(record.content)) return record.content.map((item) => extractText(item as Json)).filter(Boolean).join(' ').trim()
  return Object.values(record).map((item) => extractText(item)).filter(Boolean).join(' ').trim()
}

function compactStemForPrompt(stem: SourceStem): Record<string, unknown> {
  return {
    id: stem.id,
    categoryName: stem.category_name ?? null,
    stemText: extractText(stem.stem_text).slice(0, 2400),
    questions: (stem.questions ?? []).slice(0, 4).map((question) => ({
      questionText: extractText((question.question_text ?? null) as Json).slice(0, 220),
      questionType: question.question_type ?? 'multiple_choice',
      answerExplanation: extractText((question.answer_explanation ?? null) as Json).slice(0, 700),
      tags: (question.tags ?? []).map((tag) => tag.name).filter(Boolean),
      options: (question.answer_options ?? []).slice(0, 5).map((option) => ({
        answerText: extractText((option.answer_text ?? null) as Json).slice(0, 100),
        ...(question.question_type === 'syllogism'
          ? { answerExplanation: extractText((option.answer_explanation ?? null) as Json).slice(0, 240) }
          : {}),
        isAnswer: !!option.is_answer,
      })),
    })),
  }
}

function collectImageRefsFromJson(value: Json | null | undefined, params: {
  sourceStemId: string
  field: string
  imageIndex: { value: number }
}): SourceImageRef[] {
  const refs: SourceImageRef[] = []

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }

    const record = node as Record<string, unknown>
    if (record.type === 'image' && record.attrs && typeof record.attrs === 'object' && !Array.isArray(record.attrs)) {
      const attrs = record.attrs as Record<string, unknown>
      const src = typeof attrs.src === 'string' && attrs.src.trim() ? attrs.src.trim() : null
      const fileId = typeof attrs.fileId === 'string' && attrs.fileId.trim() ? attrs.fileId.trim() : null
      const alt = typeof attrs.alt === 'string' && attrs.alt.trim() ? attrs.alt.trim() : null
      const storagePath = src ? extractUcatImagePathFromSignedUrl(src) : null
      if (src || fileId || storagePath) {
        params.imageIndex.value += 1
        refs.push({
          sourceStemId: params.sourceStemId,
          field: params.field,
          imageIndex: params.imageIndex.value,
          fileId,
          storagePath,
          src,
          alt,
        })
      }
    }

    const content = record.content
    if (Array.isArray(content)) {
      for (const child of content) visit(child)
    }
  }

  visit(value)
  return refs
}

function collectSourceImageRefs(stems: SourceStem[], limit = MAX_SOURCE_IMAGES_FOR_WRITER): SourceImageRef[] {
  const refs: SourceImageRef[] = []
  for (const stem of stems) {
    const imageIndex = { value: 0 }
    refs.push(...collectImageRefsFromJson(stem.stem_text, {
      sourceStemId: stem.id,
      field: 'stemText',
      imageIndex,
    }))
    for (const [questionIndex, question] of (stem.questions ?? []).entries()) {
      refs.push(...collectImageRefsFromJson((question.question_text ?? null) as Json | null, {
        sourceStemId: stem.id,
        field: `questions.${questionIndex}.questionText`,
        imageIndex,
      }))
      for (const [optionIndex, option] of (question.answer_options ?? []).entries()) {
        refs.push(...collectImageRefsFromJson((option.answer_text ?? null) as Json | null, {
          sourceStemId: stem.id,
          field: `questions.${questionIndex}.options.${optionIndex}.answerText`,
          imageIndex,
        }))
      }
    }
    if (refs.length >= limit) break
  }
  return refs.slice(0, limit)
}

async function resolveSourceWriterImages(refs: SourceImageRef[]): Promise<SourceWriterImage[]> {
  if (refs.length === 0) return []

  const pathsByFileId = new Map<string, string>()
  const missingFileIds = [...new Set(refs
    .filter((ref) => !ref.storagePath && ref.fileId)
    .map((ref) => ref.fileId!)
  )]

  if (missingFileIds.length > 0 && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('files')
      .select('id,bucket,storage_path')
      .in('id', missingFileIds)
    for (const file of data ?? []) {
      if (file.bucket === 'ucat-images' && typeof file.storage_path === 'string') {
        pathsByFileId.set(file.id, file.storage_path)
      }
    }
  }

  const resolved: SourceWriterImage[] = []
  for (const ref of refs) {
    const path = ref.storagePath ?? (ref.fileId ? pathsByFileId.get(ref.fileId) ?? null : null)
    let signedUrl: string | null = null

    if (path && supabaseAdmin) {
      const { data } = await supabaseAdmin.storage
        .from('ucat-images')
        .createSignedUrl(path, REFRESHED_URL_EXPIRY_SECONDS)
      signedUrl = data?.signedUrl ?? null
    } else if (ref.src && /^https?:\/\//iu.test(ref.src)) {
      signedUrl = ref.src
    }

    if (signedUrl) {
      resolved.push({ ...ref, storagePath: path ?? ref.storagePath, signedUrl })
    }
  }

  return resolved
}

function sourceImagePromptSummary(images: SourceWriterImage[]): Array<Record<string, unknown>> {
  return images.map((image) => ({
    sourceStemId: image.sourceStemId,
    imageIndex: image.imageIndex,
    field: image.field,
    alt: image.alt,
    fileId: image.fileId,
    storagePath: image.storagePath,
  }))
}

function buildWriterUserContentParts(params: {
  userPrompt: string
  images: SourceWriterImage[]
}): UcatAiUserContentPart[] | undefined {
  if (params.images.length === 0) return undefined
  const parts: UcatAiUserContentPart[] = [
    { type: 'text', text: params.userPrompt },
    {
      type: 'text',
      text: [
        'Attached source-example images follow.',
        'Use them only to calibrate UCAT visual-source style, density, and layout conventions.',
        'Do not copy exact values, labels, premises, image composition, or answer logic from the source examples.',
      ].join(' '),
    },
  ]

  for (const image of params.images) {
    parts.push({
      type: 'text',
      text: `Source example ${image.sourceStemId}, image ${image.imageIndex}, field ${image.field}${image.alt ? `, alt: ${image.alt}` : ''}.`,
    })
    parts.push({
      type: 'image',
      imageUrl: image.signedUrl,
      detail: SOURCE_IMAGE_DETAIL,
    })
  }

  return parts
}

function normalizeVrParagraphs(stem: GeneratedStem, sectionName: string): GeneratedStem {
  if (sectionName !== 'Verbal Reasoning') return stem

  const existingParagraphs =
    typeof stem.stemText === 'string'
      ? stem.stemText
          .split(/\n{2,}|\r?\n/u)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
      : stem.stemText
          .filter((block) => block.type === 'paragraph')
          .map((block) => block.type === 'paragraph' ? block.text.trim() : '')
          .filter(Boolean)
  if (existingParagraphs.length >= 2 && existingParagraphs.length <= 6) return stem
  if (existingParagraphs.length !== 1) return stem

  const sentences = existingParagraphs[0]
    .match(/[^.!?]+(?:[.!?]+["')\]]*|$)/gu)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? []
  if (sentences.length < 4) return stem

  const targetParagraphCount = sentences.length >= 9 ? 3 : 2
  const paragraphSize = Math.ceil(sentences.length / targetParagraphCount)
  const paragraphs = Array.from({ length: targetParagraphCount }, (_, index) =>
    sentences.slice(index * paragraphSize, (index + 1) * paragraphSize).join(' ')
  ).filter(Boolean)

  return {
    ...stem,
    stemText: paragraphs.map((text) => ({ type: 'paragraph' as const, text })),
    warnings: [...stem.warnings, 'Passage paragraph breaks were normalized after generation.'],
  }
}

function plannedCategoryName(plan: unknown): string | null {
  if (!plan || typeof plan !== 'object') return null
  const plans = (plan as { plans?: unknown }).plans
  const firstPlan = Array.isArray(plans) ? plans[0] : null
  if (!firstPlan || typeof firstPlan !== 'object') return null
  const categoryName = (firstPlan as { categoryName?: unknown }).categoryName
  return typeof categoryName === 'string' && categoryName.trim() ? categoryName : null
}

function withSameCategoryRegenNote(
  plan: Record<string, unknown>,
  attempt: number,
): Record<string, unknown> {
  if (attempt <= 0) return plan
  const plans = Array.isArray(plan.plans) ? plan.plans : []
  const firstPlan = plans[0]
  if (!firstPlan || typeof firstPlan !== 'object') return plan
  const existingNotes = (firstPlan as { notes?: unknown }).notes
  const baseNotes = typeof existingNotes === 'string' ? existingNotes.trim() : ''
  return {
    ...plan,
    plans: [
      {
        ...(firstPlan as Record<string, unknown>),
        regenerationAttempt: attempt + 1,
        notes: [
          baseNotes,
          'Previous attempt failed blocking quality gates or schema validation.',
          'Produce a fresh, distinct item in the same planned category that satisfies structural UCAT rules.',
        ].filter(Boolean).join(' '),
      },
      ...plans.slice(1),
    ],
  }
}

function promptExampleCategory(example: Record<string, unknown>): string | null {
  const categoryName = example.categoryName
  return typeof categoryName === 'string' && categoryName.trim() ? categoryName : null
}

function generatedExampleContainsImage(value: unknown): boolean {
  if (typeof value === 'string') return /(?:^|\s)image\s+https?:\/\//iu.test(value)
  if (Array.isArray(value)) return value.some(generatedExampleContainsImage)
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (record.type === 'image' || record.type === 'visual') return true
  return Object.values(record).some(generatedExampleContainsImage)
}

function vennDiagramLocationForExample(example: Record<string, unknown>): 'stem' | 'answer_options' {
  const questions = Array.isArray(example.questions) ? example.questions : []
  const hasOptionImage = questions.some((rawQuestion) => {
    if (!rawQuestion || typeof rawQuestion !== 'object') return false
    const options = Array.isArray((rawQuestion as Record<string, unknown>).options)
      ? (rawQuestion as Record<string, unknown>).options as unknown[]
      : []
    return options.some((rawOption) => {
      if (!rawOption || typeof rawOption !== 'object') return false
      return generatedExampleContainsImage((rawOption as Record<string, unknown>).answerText)
    })
  })
  return hasOptionImage ? 'answer_options' : 'stem'
}

function rotatingExamples(
  examples: Array<Record<string, unknown>>,
  index: number,
  limit: number
): Array<Record<string, unknown>> {
  if (examples.length === 0 || limit <= 0) return []
  const start = examples.length > 0 ? (index * 2) % examples.length : 0
  return Array.from(
    { length: Math.min(limit, examples.length) },
    (_, offset) => examples[(start + offset) % examples.length]
  ).filter((example): example is Record<string, unknown> => !!example)
}

function categoryBalancedExamples(
  examples: Array<Record<string, unknown>>,
  index: number,
  limit: number
): Array<Record<string, unknown>> {
  if (examples.length === 0 || limit <= 0) return []

  const groups = new Map<string, Array<Record<string, unknown>>>()
  for (const example of examples) {
    const key = promptExampleCategory(example) ?? 'uncategorized'
    groups.set(key, [...(groups.get(key) ?? []), example])
  }

  const categoryKeys = Array.from(groups.keys())
  if (categoryKeys.length <= 1) return rotatingExamples(examples, index, limit)

  const picked: Array<Record<string, unknown>> = []
  const seen = new Set<Record<string, unknown>>()
  const offsets = new Map(categoryKeys.map((key) => [key, index % (groups.get(key)?.length || 1)]))

  while (picked.length < limit && seen.size < examples.length) {
    let pickedThisPass = false
    for (let offset = 0; offset < categoryKeys.length && picked.length < limit; offset += 1) {
      const key = categoryKeys[(index + offset) % categoryKeys.length]
      const group = groups.get(key) ?? []
      if (group.length === 0) continue
      const groupOffset = offsets.get(key) ?? 0
      const example = group[groupOffset % group.length]
      offsets.set(key, groupOffset + 1)
      if (!example || seen.has(example)) continue
      picked.push(example)
      seen.add(example)
      pickedThisPass = true
    }
    if (!pickedThisPass) break
  }

  return picked
}

function briefForSingleStem(brief: AiGenerationBrief, index: number, plan: unknown): AiGenerationBrief {
  const planCategoryName = plannedCategoryName(plan)
  const categoryName = brief.categoryName ?? planCategoryName
  const isQrDefault = brief.sectionName === 'Quantitative Reasoning' && !brief.categoryName
  const isDmVenn = normalizeLabel(brief.sectionName) === 'decision making' && normalizeLabel(categoryName) === 'venn diagrams'
  const maxExamples = brief.sectionName === 'Quantitative Reasoning' ? 6 : 4
  const referenceExample = isQrDefault ? rotatingExamples(brief.examples, index, 1)[0] ?? null : null
  const matchingExamples = brief.examples.filter((example) => {
    const exampleCategoryName = promptExampleCategory(example)
    if (categoryName && normalizeLabel(exampleCategoryName) !== normalizeLabel(categoryName)) return false
    if (normalizeLabel(categoryName) !== 'logical puzzles') return true
    const text = JSON.stringify(example).toLowerCase()
    return !/(?:probability|chance|likelihood|\d+%)/u.test(text)
  })
  const examplePool = matchingExamples.length > 0 ? matchingExamples : brief.examples
  const vennStructureReference = isDmVenn && examplePool.length > 0
    ? examplePool[index % examplePool.length] ?? null
    : null
  const selectedExamples = isQrDefault && referenceExample
    ? [
        referenceExample,
        ...categoryBalancedExamples(brief.examples, index, maxExamples)
          .filter((example) => example !== referenceExample),
      ].slice(0, maxExamples)
    : isQrDefault && planCategoryName
    ? [
        ...rotatingExamples(matchingExamples, index, Math.min(4, maxExamples)),
        ...categoryBalancedExamples(
          brief.examples.filter((example) => !matchingExamples.includes(example)),
          index,
          Math.max(0, maxExamples - Math.min(4, matchingExamples.length))
        ),
      ].slice(0, maxExamples)
    : categoryBalancedExamples(examplePool, index, maxExamples)
  const examples = vennStructureReference
    ? [
        vennStructureReference,
        ...selectedExamples.filter((example) => example !== vennStructureReference),
      ].slice(0, maxExamples)
    : selectedExamples
  const exampleIds = new Set(examples.map((example) => typeof example.id === 'string' ? example.id : null).filter(Boolean))
  return {
    ...brief,
    categoryName: brief.categoryName,
    availableCategories: brief.categoryName ? [] : brief.availableCategories,
    stemCount: 1,
    examples,
    presentationReference: referenceExample
      ? {
          id: typeof referenceExample.id === 'string' ? referenceExample.id : null,
          categoryName: promptExampleCategory(referenceExample),
          stemText: referenceExample.stemText ?? null,
        }
      : null,
    vennStructureReference: vennStructureReference
      ? {
          id: typeof vennStructureReference.id === 'string' ? vennStructureReference.id : null,
          stemText: vennStructureReference.stemText ?? null,
          questions: vennStructureReference.questions ?? null,
          diagramLocation: vennDiagramLocationForExample(vennStructureReference),
        }
      : null,
    sourceImagesForCalibration: (brief.sourceImagesForCalibration ?? []).filter((image) => {
      const sourceStemId = image.sourceStemId
      return typeof sourceStemId === 'string' && exampleIds.has(sourceStemId)
    }),
    promptLayers: brief.promptLayers.filter((layer) => {
      if (brief.categoryName && layer.scopeType === 'stem_category') return layer.name === brief.categoryName
      if (!brief.categoryName && layer.scopeType === 'stem_category') return layer.name === planCategoryName
      return true
    }),
  }
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = []
  let nextIndex = 0

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await tasks[currentIndex]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
}

function sourcePlainText(stem: SourceStem): string {
  return [
    extractText(stem.stem_text),
    ...(stem.questions ?? []).flatMap((question) => [
      extractText((question.question_text ?? null) as Json),
      ...(question.answer_options ?? []).map((option) => extractText((option.answer_text ?? null) as Json)),
    ]),
  ]
    .filter(Boolean)
    .join('\n')
}

function difficultyToNumber(value: number | null | undefined, target: string | undefined): number | null {
  if (typeof value === 'number') return value
  if (target === 'easy') return 0.25
  if (target === 'medium') return 0.55
  if (target === 'hard') return 0.82
  return null
}

function issueMessages(issues: GenerationGateIssue[]): string[] {
  return issues
    .filter((issue) => issue.severity === 'warning')
    .map((issue) => issue.questionIndex == null ? issue.message : `Q${issue.questionIndex + 1}: ${issue.message}`)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown generation error'
}

function isImageInputUnsupportedError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase()
  return (
    message.includes('input_image') ||
    message.includes('image_url') ||
    message.includes('image input') ||
    message.includes('image inputs') ||
    message.includes('does not support image') ||
    message.includes('unsupported image') ||
    message.includes('multimodal')
  )
}

type ImageGenerationMode = z.infer<typeof GenerateBodySchema>['imageGenerationMode']

type GeneratedImageRecord = {
  fileId: string
  storagePath: string
  visualType: string
  sourceVisualTypes: string[]
  prompt: string
}

const AI_IMAGE_AUTO_VISUAL_TYPES = new Set<string>()

function shouldUseAiImageForStemVisual(params: {
  mode: ImageGenerationMode
  categoryName: string | null | undefined
  block: Extract<GeneratedContentBlock, { type: 'visual' }>
}): boolean {
  if (params.mode === 'deterministic') return false
  if (params.mode === 'ai') return true
  const category = normalizeLabel(params.categoryName)
  if (category === 'venn diagrams' || category === 'logical puzzles') return false
  return AI_IMAGE_AUTO_VISUAL_TYPES.has(params.block.visualType)
}

function resolveStemImageApiConfig(config: UcatAiResolvedConfig) {
  try {
    return resolveImageApiConfig()
  } catch (error) {
    if (config.provider.provider_kind === 'codex_oauth') {
      throw new Error('AI image generation needs an OpenAI API key. The selected Codex subscription provider can generate text for this app, but it does not expose an image-generation API endpoint.')
    }

    const apiKey = process.env[config.provider.secret_env_var_name]
    if (!apiKey) throw error
    const baseUrl = config.provider.base_url.replace(/\/$/u, '')
    const providerLooksOpenAiCompatible = config.provider.provider_key === 'openai' || baseUrl.includes('api.openai.com')
    if (!providerLooksOpenAiCompatible) {
      throw new Error(`AI image generation is not configured for provider "${config.provider.name}". Configure UCAT_IMAGE_OPENAI_API_KEY/OPENAI_API_KEY, or select an OpenAI-compatible image provider.`)
    }

    return {
      apiKey,
      model: process.env.UCAT_IMAGE_MODEL || 'gpt-image-1',
      baseUrl,
    }
  }
}

function generatedStemImagePrompt(params: {
  stem: GeneratedStem
  visualBlocks: Array<Extract<GeneratedContentBlock, { type: 'visual' }>>
}): string {
  const stemContext = generatedContentToPlainText(params.stem.stemText).slice(0, 1800)
  const visualIntents = params.visualBlocks.map((block, index) => ({
    index: index + 1,
    visualTypeHint: block.visualType,
    title: block.title ?? null,
    altText: block.altText,
    spec: block.spec,
  }))
  return [
    'Create one clean UCAT-style exam source image as a PNG.',
    'Use a white background, crisp black or restrained colour strokes, readable labels, and no decorative illustration.',
    'Choose the most natural UCAT-style source-image format for the data: chart, table, map, timetable, mixed-source panel, spatial layout, Venn/set diagram, or another clear exam visual.',
    'Do not mechanically copy the visualType hints if a different single source-image composition would be clearer or more realistic.',
    'The image must be self-contained and must render every number, category label, unit, shape, axis, legend item, and region value exactly from the structured data and stem context.',
    'Do not invent extra values, labels, icons, people, scenery, watermarks, logos, or explanatory prose.',
    'If this is a Venn or set diagram, place numbers from semantic set regions, not from approximate pixel coordinates. Keep numbers inside their regions and off boundaries.',
    'If this is a chart or multi-panel source, scale axes correctly, keep labels readable, include units where provided, and use enough visual density for UCAT quantitative reasoning.',
    'If there are multiple visual intents, combine them into one coherent stem source image rather than separate unrelated pictures.',
    '',
    `Category: ${params.stem.categoryName ?? 'Unspecified'}`,
    `Stem context: ${stemContext}`,
    `Structured visual/data intents JSON:\n${JSON.stringify(visualIntents, null, 2)}`,
  ].join('\n')
}

async function generateImageBytes(params: {
  apiKey: string
  baseUrl: string
  model: string
  prompt: string
}): Promise<Buffer> {
  const size = process.env.UCAT_GENERATED_STEM_IMAGE_SIZE || '1536x1024'
  const imageApiModel = params.model.startsWith('gpt-image') || params.model.startsWith('dall-e')
  if (imageApiModel) {
    const response = await fetch(`${params.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        prompt: params.prompt,
        size,
      }),
    })
    return openAiImageToBuffer(response)
  }

  const response = await fetch(`${params.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
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

async function generateUploadedStemImage(params: {
  stem: GeneratedStem
  visualBlocks: Array<Extract<GeneratedContentBlock, { type: 'visual' }>>
  config: UcatAiResolvedConfig
}): Promise<{ block: GeneratedContentBlock; metadata: GeneratedImageRecord }> {
  const prompt = generatedStemImagePrompt(params)
  const imageConfig = resolveStemImageApiConfig(params.config)
  const sourceVisualTypes = params.visualBlocks.map((block) => block.visualType)
  const bytes = await generateImageBytes({
    apiKey: imageConfig.apiKey,
    baseUrl: imageConfig.baseUrl,
    model: imageConfig.model,
    prompt,
  })
  const uploaded = await uploadGeneratedUcatImage({
    bytes,
    mimeType: 'image/png',
    filename: 'generated-stem-source-image.png',
    sourcePrompt: prompt,
  })
  return {
    block: {
      type: 'image',
      src: uploaded.signedUrl,
      altText: params.visualBlocks.map((block) => block.altText).filter(Boolean).join(' '),
      fileId: uploaded.fileId,
    },
    metadata: {
      fileId: uploaded.fileId,
      storagePath: uploaded.storagePath,
      visualType: 'stem_source_image',
      sourceVisualTypes,
      prompt,
    },
  }
}

async function resolveStemImageBlocks(params: {
  stem: GeneratedStem
  mode: ImageGenerationMode
  config: UcatAiResolvedConfig
}): Promise<{ stem: GeneratedStem; generatedImages: GeneratedImageRecord[]; warnings: string[] }> {
  if (typeof params.stem.stemText === 'string') {
    return { stem: params.stem, generatedImages: [], warnings: [] }
  }

  const eligibleVisuals = params.stem.stemText.filter((block): block is Extract<GeneratedContentBlock, { type: 'visual' }> =>
    block.type === 'visual' && shouldUseAiImageForStemVisual({ mode: params.mode, categoryName: params.stem.categoryName, block })
  )
  if (eligibleVisuals.length === 0) {
    return { stem: params.stem, generatedImages: [], warnings: [] }
  }

  try {
    const uploaded = await generateUploadedStemImage({ stem: params.stem, visualBlocks: eligibleVisuals, config: params.config })
    let inserted = false
    const stemText: GeneratedContentBlock[] = []
    for (const block of params.stem.stemText) {
      if (block.type !== 'visual' || !eligibleVisuals.includes(block)) {
        stemText.push(block)
        continue
      }
      if (!inserted) {
        stemText.push(uploaded.block)
        inserted = true
      }
    }

    return {
      stem: { ...params.stem, stemText },
      generatedImages: [uploaded.metadata],
      warnings: [],
    }
  } catch (error) {
    if (params.mode === 'ai') throw error
    const warning = `AI image generation is unavailable; used deterministic renderer instead. ${errorMessage(error)}`
    return {
      stem: { ...params.stem, warnings: [...params.stem.warnings, warning] },
      generatedImages: [],
      warnings: [warning],
    }
  }
}

function isCapturedAiResponseError(
  error: unknown
): error is UcatAiJsonParseError | UcatAiEmptyResponseError {
  return error instanceof UcatAiJsonParseError || error instanceof UcatAiEmptyResponseError
}

async function currentTutorId(client: SupabaseClient<Database>): Promise<string | null> {
  const { data, error } = await asAny(client).rpc('current_tutor_id')
  if (error || typeof data !== 'string') return null
  return data
}

export async function createGenerationRun(params: {
  client: SupabaseClient<Database>
  body: GenerateBody
  modelProfileId: string | null
}): Promise<string | null> {
  const staffId = await currentTutorId(params.client)
  if (!staffId) return null

  const { data, error } = await asAny(params.client)
    .from('ucat_ai_generation_runs')
    .insert({
      section_id: params.body.sectionId,
      question_stem_category_id: params.body.categoryId ?? null,
      model_profile_id: params.modelProfileId,
      status: 'running',
      requested_stem_count: params.body.stemCount,
      created_by: staffId,
      updated_by: staffId,
    })
    .select('id')
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id as string
}

export async function updateGenerationRun(params: {
  client: SupabaseClient<Database>
  runId: string | null | undefined
  status: 'completed' | 'failed'
  acceptedStemCount?: number
  discardedStemCount?: number
  errorMessage?: string | null
  debug: GenerationDebugInfo | null
}) {
  if (!params.runId) return
  const staffId = await currentTutorId(params.client)
  const payload: Record<string, unknown> = {
    status: params.status,
    accepted_stem_count: params.acceptedStemCount ?? 0,
    discarded_stem_count: params.discardedStemCount ?? 0,
    error_message: params.errorMessage ?? null,
    debug_payload: params.debug ?? null,
  }
  if (staffId) payload.updated_by = staffId

  await asAny(params.client)
    .from('ucat_ai_generation_runs')
    .update(payload)
    .eq('id', params.runId)
}

function applySourceStemFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  body: z.infer<typeof GenerateBodySchema>,
) {
  let next = query
    .eq('section_id', body.sectionId)
    .filter('status', 'eq', 'published')
    .is('deleted_at', null)

  if (body.categoryId) next = next.eq('question_stem_category_id', body.categoryId)
  if (!body.includeAiSourceStems) next = next.neq('source_channel', 'ai_generation')
  return next
}

async function fetchSourceStems(
  client: SupabaseClient<Database>,
  body: z.infer<typeof GenerateBodySchema>
): Promise<SourceStem[]> {
  if (body.sourceMode === 'none') return []

  if (body.sourceMode === 'selected') {
    if (!body.sourceStemIds || body.sourceStemIds.length === 0) {
      throw new Error('Please select at least one source stem, or choose no source examples.')
    }

    const { data, error } = await applySourceStemFilters(
      asAny(client)
        .from('vtutor_ucat_question_stem_detail')
        .select(SOURCE_STEM_DETAIL_SELECT)
        .in('id', body.sourceStemIds),
      body,
    )
    if (error) throw new Error(error.message)

    const source = ((data ?? []) as unknown as SourceStem[]).filter((row) => row.id)
    return prioritizeTagMatches(
      sampleWithoutReplacement(source, source.length),
      body.targetTagIds,
    ).slice(0, 8)
  }

  // Random mode: DB-side uniform sample of IDs (scales past PostgREST max_rows),
  // then load stem details for the sample only.
  const { data: sampledIdData, error: idError } = await asAny(client).rpc(
    'tutor_ucat_sample_question_stem_ids',
    {
      p_section_id: body.sectionId,
      p_limit: RANDOM_SOURCE_STEM_LIMIT,
      p_category_id: body.categoryId ?? null,
      p_include_ai_source_stems: body.includeAiSourceStems,
    },
  )
  if (idError) throw new Error(idError.message)

  const sampledIds = (Array.isArray(sampledIdData) ? sampledIdData : [])
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (sampledIds.length === 0) return []

  const { data, error } = await asAny(client)
    .from('vtutor_ucat_question_stem_detail')
    .select(SOURCE_STEM_DETAIL_SELECT)
    .in('id', sampledIds)
  if (error) throw new Error(error.message)

  const byId = new Map(
    ((data ?? []) as unknown as SourceStem[])
      .filter((row) => row.id)
      .map((row) => [row.id, row]),
  )
  // Preserve the sampled order (and therefore empirical category frequency).
  const source = sampledIds
    .map((id) => byId.get(id))
    .filter((row): row is SourceStem => !!row)

  // Tag prioritization reorders for calibration; category multiset is unchanged.
  return prioritizeTagMatches(source, body.targetTagIds)
}

function sourceStemTagMatchCount(stem: SourceStem, targetTagIds: string[]): number {
  if (targetTagIds.length === 0) return 0
  const targetIds = new Set(targetTagIds)
  const stemTagIds = new Set<string>()
  for (const question of stem.questions ?? []) {
    for (const tag of question.tags ?? []) {
      if (tag.id) stemTagIds.add(tag.id)
    }
  }
  let count = 0
  for (const id of stemTagIds) {
    if (targetIds.has(id)) count += 1
  }
  return count
}

function prioritizeTagMatches(stems: SourceStem[], targetTagIds: string[]): SourceStem[] {
  if (targetTagIds.length === 0) return stems
  return stems
    .map((stem, index) => ({
      stem,
      index,
      tagMatches: sourceStemTagMatchCount(stem, targetTagIds),
    }))
    .sort((a, b) => b.tagMatches - a.tagMatches || a.index - b.index)
    .map((item) => item.stem)
}

async function fetchTargetTags(client: SupabaseClient<Database>, tagIds: string[]) {
  if (tagIds.length === 0) return []
  const { data, error } = await asAny(client)
    .from('vtutor_ucat_question_tags')
    .select('id,name')
    .in('id', tagIds)
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as Array<{ id: string; name: string | null }>).map((tag) => ({
    id: tag.id,
    name: tag.name ?? 'Untitled tag',
  }))
}

async function fetchSectionCategories(
  client: SupabaseClient<Database>,
  sectionId: string
): Promise<StemCategoryChoice[]> {
  const { data, error } = await asAny(client)
    .from('vtutor_ucat_question_stem_categories')
    .select('id,name,ucat_section_id')
    .eq('ucat_section_id', sectionId)
    .order('name')
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as Array<{ id: string; name: string | null }>).map((category) => ({
    id: category.id,
    name: category.name ?? 'Untitled category',
  }))
}

async function fetchBankComparisonSources(
  client: SupabaseClient<Database>,
  sectionId: string
): Promise<GenerationComparisonSource[]> {
  const { data, error } = await asAny(client)
    .from('vtutor_ucat_question_stem_detail')
    .select('id,stem_text,questions')
    .eq('section_id', sectionId)
    .filter('status', 'eq', 'published')
    .is('deleted_at', null)
    .limit(300)
  if (error) return []
  return ((data ?? []) as unknown as SourceStem[])
    .map((source) => ({ id: source.id, text: sourcePlainText(source) }))
    .filter((source) => source.text.trim().length > 0)
}

async function buildPromptLayers(params: {
  client: SupabaseClient<Database>
  sectionId: string
  sectionName: string
  categoryId: string | null
  categoryName: string | null
  availableCategories: StemCategoryChoice[]
  tags: Array<{ id: string; name: string }>
}): Promise<AiGenerationBrief['promptLayers']> {
  const includeCategoryLayers = !!params.categoryId || params.sectionName !== 'Quantitative Reasoning'
  const layers = await getUcatAiPromptLayers({
    client: params.client,
    sectionId: params.sectionId,
    categoryId: params.categoryId,
    categoryIds: params.categoryId || !includeCategoryLayers ? [] : params.availableCategories.map((category) => category.id),
    tagIds: params.tags.map((tag) => tag.id),
  })
  return layers.map((layer) => {
    const tag = params.tags.find((item) => item.id === layer.scope_id)
    const category = params.availableCategories.find((item) => item.id === layer.scope_id)
    return {
      scopeType: layer.scope_type,
      name:
        layer.scope_type === 'section'
          ? params.sectionName
          : layer.scope_type === 'stem_category'
            ? params.categoryName ?? category?.name ?? 'Selected category'
            : tag?.name ?? 'Selected tag',
      promptText: layer.prompt_text,
      version: layer.prompt_version,
    }
  })
}

export type PreparedGenerationContext = {
  section: { id: string; name: string | null }
  categoryChoices: StemCategoryChoice[]
  categoryName: string | null
  sourceSamples: SourceStem[]
  targetTags: Array<{ id: string; name: string }>
  comparisonSources: GenerationComparisonSource[]
}

export async function prepareGenerationContext(
  client: SupabaseClient<Database>,
  body: GenerateBody,
): Promise<PreparedGenerationContext> {
  const { data: section, error: sectionError } = await asAny(client)
    .from('vtutor_ucat_sections')
    .select('id,name')
    .eq('id', body.sectionId)
    .maybeSingle()
  const sectionRow = section as { id: string; name: string | null } | null
  if (sectionError || !sectionRow) throw new Error('Section not found')

  const categoryChoices = await fetchSectionCategories(client, body.sectionId)
  const categoryName = body.categoryId
    ? categoryChoices.find((category) => category.id === body.categoryId)?.name ?? null
    : null
  if (body.categoryId && !categoryName) throw new Error('Invalid category for selected section')

  const [sourceSamples, targetTags, comparisonSources] = await Promise.all([
    fetchSourceStems(client, body),
    fetchTargetTags(client, body.targetTagIds),
    fetchBankComparisonSources(client, body.sectionId),
  ])

  return {
    section: sectionRow,
    categoryChoices,
    categoryName,
    sourceSamples,
    targetTags,
    comparisonSources,
  }
}

async function toDraft(params: {
  stem: GeneratedStem
  body: z.infer<typeof GenerateBodySchema>
  warnings: string[]
  sampleStemIds: string[]
  modelProfileId: string | null
  providerId: string | null
  model: string
  metadata: Record<string, unknown>
  categoryIdByName: Map<string, string>
}) {
  const generatedCategoryId =
    params.stem.categoryId ??
    params.body.categoryId ??
    params.categoryIdByName.get(normalizeLabel(params.stem.categoryName)) ??
    null
  const questions = await Promise.all(params.stem.questions.map(async (question, questionIndex) => ({
    index: questionIndex + 1,
    questionText: await generatedContentToProseMirrorServer(question.questionText),
    answerExplanation: question.answerExplanation ? await generatedContentToProseMirrorServer(question.answerExplanation) : null,
    difficulty: difficultyToNumber(question.estimatedDifficulty, question.difficultyTarget),
    timeBurdenSeconds: question.estimatedTimeBurdenSeconds ?? null,
    questionType: question.questionType === 'syllogism' ? 'syllogism' : 'multiple_choice',
    tagIds: question.tagIds?.length ? question.tagIds : params.body.targetTagIds,
    options: await Promise.all(question.options.map(async (option, optionIndex) => ({
      index: optionIndex + 1,
      answerText: await generatedContentToProseMirrorServer(option.answerText),
      answerExplanation: option.answerExplanation ? await generatedContentToProseMirrorServer(option.answerExplanation) : null,
      isAnswer: !!option.isAnswer,
    }))),
  })))

  return {
    sectionId: params.body.sectionId,
    categoryId: generatedCategoryId,
    stemText: await generatedContentToProseMirrorServer(params.stem.stemText),
    accessScope: 'public',
    questions,
    aiGenerationMetadata: {
      source: 'ucat-ai-generation',
      generatedAt: new Date().toISOString(),
      sampleStemIds: params.sampleStemIds,
      modelProfileId: params.modelProfileId,
      providerId: params.providerId,
      model: params.model,
      generationBrief: {
        sectionId: params.body.sectionId,
        categoryId: generatedCategoryId,
        requestedCategoryId: params.body.categoryId ?? null,
        generatedCategoryName: params.stem.categoryName ?? null,
        difficultyTarget: params.body.difficultyTarget,
        timeBurdenTarget: params.body.timeBurdenTarget,
        targetTagIds: params.body.targetTagIds,
        includeAiSourceStems: params.body.includeAiSourceStems,
        imageGenerationMode: params.body.imageGenerationMode,
        runInstructions: params.body.runInstructions ?? null,
      },
      warnings: [...params.stem.warnings, ...params.warnings],
      ...params.metadata,
    } as Json,
  }
}

export async function executeGeneration(
  client: SupabaseClient<Database>,
  body: GenerateBody,
  emitProgress: EmitProgress = () => undefined,
  actor: GenerationActor = { userId: null, name: null, email: null },
  options: {
    runId?: string | null
    prepared?: PreparedGenerationContext
    deferCompletion?: boolean
  } = {},
): Promise<GenerationResult> {
  let debug: GenerationDebugInfo | null = null

  try {
    await emitProgress({
      type: 'progress',
      step: 'setup',
      message: 'Loading model profile and generation settings',
      completedStems: 0,
      totalStems: body.stemCount,
    })
    const config = await resolveUcatAiConfig(client, body.modelProfileId)
    const runId = options.runId ?? await createGenerationRun({
      client,
      body,
      modelProfileId: config.modelProfile.id,
    })
    await emitProgress({
      type: 'progress',
      step: 'setup',
      message: runId ? 'Generation run created' : 'Generation run started',
      completedStems: 0,
      totalStems: body.stemCount,
      runId,
    })

    if (body.stemCount > config.settings.max_requested_stems_per_run) {
      const message = `Generation runs are capped at ${config.settings.max_requested_stems_per_run} requested stems.`
      await updateGenerationRun({
        client,
        runId,
        status: 'failed',
        errorMessage: message,
        debug,
      })
      return { status: 400, payload: { error: message, debugRunId: runId } }
    }

    const prepared = options.prepared ?? await prepareGenerationContext(client, body)
    const sectionRow = prepared.section
    const categoryChoices = prepared.categoryChoices
    const categoryIdByName = new Map(categoryChoices.map((category) => [normalizeLabel(category.name), category.id]))
    const categoryName = prepared.categoryName

    await emitProgress({
      type: 'progress',
      step: 'sources',
      message: 'Selecting source examples and prompt layers',
      completedStems: 0,
      totalStems: body.stemCount,
      runId,
    })
    const sourceSamples = prepared.sourceSamples
    const targetTags = prepared.targetTags
    const promptLayers = await buildPromptLayers({
      client,
      sectionId: body.sectionId,
      sectionName: sectionRow.name ?? 'UCAT',
      categoryId: body.categoryId ?? null,
      categoryName,
      availableCategories: categoryChoices,
      tags: targetTags,
    })
    const examples = sourceSamples.map(compactStemForPrompt)
    const sourceSamplesById = new Map(sourceSamples.map((sample) => [sample.id, sample]))
    const sourceImagePromises = new Map<string, Promise<SourceWriterImage[]>>()
    const usedSourceImages = new Map<string, SourceWriterImage>()
    const imagesForExampleIds = async (ids: Set<string>): Promise<SourceWriterImage[]> => {
      const groups = await Promise.all(Array.from(ids).map(async (id) => {
        const source = sourceSamplesById.get(id)
        if (!source) return []
        let pending = sourceImagePromises.get(id)
        if (!pending) {
          pending = resolveSourceWriterImages(collectSourceImageRefs([source]))
          sourceImagePromises.set(id, pending)
        }
        return pending
      }))
      const images = groups.flat().slice(0, MAX_SOURCE_IMAGES_FOR_WRITER)
      for (const image of images) {
        usedSourceImages.set(`${image.sourceStemId}:${image.field}:${image.imageIndex}`, image)
      }
      return images
    }
    let sourceImageSummary: Array<Record<string, unknown>> = []
    const brief: AiGenerationBrief = {
      sectionName: sectionRow.name ?? 'UCAT',
      categoryName,
      availableCategories: body.categoryId ? [] : categoryChoices,
      stemCount: body.stemCount,
      difficultyTarget: body.difficultyTarget,
      timeBurdenTarget: body.timeBurdenTarget,
      targetTags,
      runInstructions: body.runInstructions ?? null,
      examples,
      sourceImagesForCalibration: [],
      promptLayers,
    }
    debug = {
      runId,
      requestedStemCount: body.stemCount,
      sectionName: sectionRow.name ?? null,
      selectedCategoryName: categoryName,
      sourceSampleIds: sourceSamples.map((sample) => sample.id),
      sourceImageCount: 0,
      sourceImagesForWriter: [],
      promptLayerCount: promptLayers.length,
      calls: [],
      gateIssues: [],
    }
    const activeDebug = debug
    const sourceComparisonSources: GenerationComparisonSource[] = [
      ...sourceSamples.map((source) => ({ id: source.id, text: sourcePlainText(source) })),
      ...prepared.comparisonSources,
    ]
    const accepted: Array<{ stem: GeneratedStem; issues: GenerationGateIssue[]; rewritten: boolean }> = []
    const discarded: Array<{ issues: GenerationGateIssue[]; rewritten: boolean }> = []

    let completedStemSlots = 0
    await emitProgress({
      type: 'progress',
      step: 'generating',
      message: `Generating ${body.stemCount} stem${body.stemCount === 1 ? '' : 's'} in parallel`,
      completedStems: completedStemSlots,
      totalStems: body.stemCount,
      runId,
    })

    type SlotResult = { stem: GeneratedStem; issues: GenerationGateIssue[] } | null

    const slotResults = await runWithConcurrency(
      Array.from({ length: body.stemCount }, (_, stemIndex) => async (): Promise<SlotResult> => {
        const basePlan = buildLocalPlan(brief, stemIndex) as Record<string, unknown>
        const planCategoryName = plannedCategoryName(basePlan)

        for (let attempt = 0; attempt < SAME_CATEGORY_ATTEMPTS; attempt += 1) {
          const plan = withSameCategoryRegenNote(basePlan, attempt)
          const singleBrief = briefForSingleStem(brief, stemIndex, plan)
          const systemPrompt = `${config.systemPrompts.base_system_prompt}\n\n${config.systemPrompts.writer_prompt}`
          const singleExampleIds = new Set(singleBrief.examples
            .map((example) => typeof example.id === 'string' ? example.id : null)
            .filter((id): id is string => !!id)
          )
          const writerSourceImages = await imagesForExampleIds(singleExampleIds)
          const writerBrief = {
            ...singleBrief,
            sourceImagesForCalibration: sourceImagePromptSummary(writerSourceImages),
          }
          const userPrompt = buildWriterPrompt({ ...writerBrief, plan })
          const writerContentParts = buildWriterUserContentParts({ userPrompt, images: writerSourceImages })
          const sectionMinimumTokens = singleBrief.sectionName === 'Decision Making'
            ? 10_000
            : GENERATION_TOKEN_LIMITS.writer
          const maxCompletionTokens = Math.max(
            sectionMinimumTokens,
            config.modelProfile.max_completion_tokens
          )
          const startedAt = Date.now()
          const categoryLabel = singleBrief.categoryName ?? planCategoryName
          const baseDebug = {
            stemIndex,
            categoryName: categoryLabel,
            operation: attempt > 0 ? 'generation_write_regen' : 'generation_write',
            request: {
              systemPrompt,
              userPrompt,
              userContentPartCount: writerContentParts?.length ?? 1,
              sourceImageCount: writerSourceImages.length,
              sourceImagesForWriter: sourceImagePromptSummary(writerSourceImages),
              maxCompletionTokens,
              timeoutMs: GENERATION_TIMEOUT_MS.writer,
              providerSort: 'throughput' as const,
            },
          }

          if (attempt > 0) {
            await emitProgress({
              type: 'progress',
              step: 'generating',
              message: categoryLabel
                ? `Stem ${stemIndex + 1}: regenerating ${categoryLabel} (attempt ${attempt + 1}/${SAME_CATEGORY_ATTEMPTS})`
                : `Stem ${stemIndex + 1}: regenerating same plan (attempt ${attempt + 1}/${SAME_CATEGORY_ATTEMPTS})`,
              completedStems: completedStemSlots,
              totalStems: body.stemCount,
              runId,
            })
          }

          let writer
          let retriedWithoutImages = false
          try {
            try {
              writer = await callUcatAiJson({
                client,
                operation: 'generation_write',
                modelProfileId: body.modelProfileId,
                systemPrompt,
                userPrompt,
                userContentParts: writerContentParts,
                temperature: Number(config.modelProfile.temperature),
                maxCompletionTokens,
                timeoutMs: GENERATION_TIMEOUT_MS.writer,
                providerSort: 'throughput',
                metadata: {
                  section: singleBrief.sectionName,
                  category: categoryLabel,
                  sourceImageCount: writerSourceImages.length,
                  attempt: attempt + 1,
                } as Json,
              })
            } catch (error) {
              if (!writerContentParts || !isImageInputUnsupportedError(error)) throw error
              retriedWithoutImages = true
              writer = await callUcatAiJson({
                client,
                operation: 'generation_write',
                modelProfileId: body.modelProfileId,
                systemPrompt,
                userPrompt,
                temperature: Number(config.modelProfile.temperature),
                maxCompletionTokens,
                timeoutMs: GENERATION_TIMEOUT_MS.writer,
                providerSort: 'throughput',
                metadata: {
                  section: singleBrief.sectionName,
                  category: categoryLabel,
                  sourceImageCount: writerSourceImages.length,
                  sourceImageFallback: 'model_rejected_image_input',
                  attempt: attempt + 1,
                } as Json,
              })
            }
          } catch (error) {
            activeDebug.calls.push({
              ...baseDebug,
              model: isCapturedAiResponseError(error) ? error.model : config.modelProfile.model,
              durationMs: Date.now() - startedAt,
              status: 'error',
              error: errorMessage(error),
              response:
                isCapturedAiResponseError(error)
                  ? {
                      content: error.content,
                      finishReason: error.finishReason,
                      usage: error.usage,
                      contentLength: error.content.length,
                    }
                  : undefined,
            })
            if (attempt + 1 < SAME_CATEGORY_ATTEMPTS) continue
            completedStemSlots += 1
            await emitProgress({
              type: 'progress',
              step: 'generating',
              message: `Stem ${stemIndex + 1} failed during model generation`,
              completedStems: completedStemSlots,
              totalStems: body.stemCount,
              runId,
            })
            return null
          }

          const parsedWriter = GeneratedCandidateResponseSchema.safeParse(writer.parsed)
          activeDebug.calls.push({
            ...baseDebug,
            model: writer.model,
            durationMs: Date.now() - startedAt,
            status: parsedWriter.success ? 'ok' : 'error',
            error: parsedWriter.success ? undefined : 'Generated JSON did not match the expected stem schema.',
            response: {
              content: writer.content,
              finishReason: writer.finishReason,
              usage: writer.usage,
              contentLength: writer.content.length,
              ...(retriedWithoutImages ? { sourceImageFallback: 'model_rejected_image_input' } : {}),
            },
            parsedSummary: parsedWriter.success
              ? {
                  stemCount: parsedWriter.data.stems.length,
                  categories: parsedWriter.data.stems.map((stem) => stem.categoryName ?? null),
                  questionCounts: parsedWriter.data.stems.map((stem) => stem.questions.length),
                }
              : undefined,
          })

          if (!parsedWriter.success) {
            if (attempt + 1 < SAME_CATEGORY_ATTEMPTS) continue
            completedStemSlots += 1
            await emitProgress({
              type: 'progress',
              step: 'generating',
              message: `Stem ${stemIndex + 1} returned but did not match the schema`,
              completedStems: completedStemSlots,
              totalStems: body.stemCount,
              runId,
            })
            return null
          }

          const rawStem = parsedWriter.data.stems[0] ?? null
          if (!rawStem) {
            if (attempt + 1 < SAME_CATEGORY_ATTEMPTS) continue
            completedStemSlots += 1
            return null
          }

          const candidate = normalizeVrParagraphs(rawStem, singleBrief.sectionName)
          const issues = validateGeneratedStemCandidate(candidate, stemIndex, {
            sectionName: brief.sectionName,
            categoryName,
            sourceComparisonSources,
          })
          activeDebug.gateIssues.push(...issues)

          if (hasBlockingIssues(issues)) {
            discarded.push({ issues, rewritten: false })
            if (attempt + 1 < SAME_CATEGORY_ATTEMPTS) {
              await emitProgress({
                type: 'progress',
                step: 'gates',
                message: categoryLabel
                  ? `Stem ${stemIndex + 1} failed gates for ${categoryLabel}; will regenerate same category`
                  : `Stem ${stemIndex + 1} failed gates; will regenerate same plan`,
                completedStems: completedStemSlots,
                totalStems: body.stemCount,
                runId,
              })
              continue
            }
            completedStemSlots += 1
            await emitProgress({
              type: 'progress',
              step: 'gates',
              message: `Stem ${stemIndex + 1} failed blocking gates after ${SAME_CATEGORY_ATTEMPTS} attempts`,
              completedStems: completedStemSlots,
              totalStems: body.stemCount,
              runId,
            })
            return null
          }

          completedStemSlots += 1
          await emitProgress({
            type: 'progress',
            step: 'generating',
            message: attempt > 0
              ? `Stem ${stemIndex + 1} passed gates after regeneration`
              : `Stem ${stemIndex + 1} returned and passed gates`,
            completedStems: completedStemSlots,
            totalStems: body.stemCount,
            runId,
          })
          return { stem: candidate, issues }
        }

        completedStemSlots += 1
        return null
      }),
      body.stemCount
    )

    for (const result of slotResults) {
      if (!result) continue
      accepted.push({ stem: result.stem, issues: result.issues, rewritten: false })
    }

    sourceImageSummary = sourceImagePromptSummary(Array.from(usedSourceImages.values()))
    activeDebug.sourceImageCount = sourceImageSummary.length
    activeDebug.sourceImagesForWriter = sourceImageSummary
    const failedCallCount = activeDebug.calls.filter((call) => call.status === 'error').length

    if (accepted.length === 0) {
      const issues = discarded.flatMap((item) => item.issues).slice(0, 10)
      const firstCallError = activeDebug.calls.find((call) => call.status === 'error')?.error
      const message = issues[0]?.message ?? firstCallError ?? 'No generated candidates passed blocking gates.'
      await updateGenerationRun({
        client,
        runId,
        status: 'failed',
        discardedStemCount: discarded.length + failedCallCount,
        errorMessage: message,
        debug,
      })
      return {
        status: 422,
        payload: {
          error: message,
          discardedCount: discarded.length + failedCallCount,
          issues,
          debug,
          debugRunId: runId,
        },
      }
    }

    await emitProgress({
      type: 'progress',
      step: 'images',
      message: body.imageGenerationMode === 'deterministic'
        ? 'Rendering deterministic visuals'
        : 'Resolving generated visuals',
      completedStems: accepted.length,
      totalStems: body.stemCount,
      runId,
    })

    const resolvedStems = await Promise.all(accepted.slice(0, body.stemCount).map(async (item) => ({
      ...item,
      imageResolution: await resolveStemImageBlocks({
        stem: item.stem,
        mode: body.imageGenerationMode,
        config,
      }),
    })))

    await emitProgress({
      type: 'progress',
      step: 'drafts',
      message: 'Preparing accepted stems for tutor review',
      completedStems: resolvedStems.length,
      totalStems: body.stemCount,
      runId,
    })
    const stems = await Promise.all(resolvedStems.map((item, outputIndex) =>
      toDraft({
        stem: item.imageResolution.stem,
        body,
        warnings: issueMessages(item.issues),
        sampleStemIds: sourceSamples.map((sample) => sample.id),
        modelProfileId: config.modelProfile.id,
        providerId: config.provider.id,
        model: config.modelProfile.model,
        metadata: {
          outputIndex,
          debugRunId: runId,
          requestedStemCount: body.stemCount,
          discardedCount: discarded.length + failedCallCount,
          rewritten: item.rewritten,
          gateIssues: item.issues,
          systemPromptVersion: config.systemPrompts.prompt_version,
          generatedByUserId: actor.userId,
          generatedByName: actor.name,
          generatedByEmail: actor.email,
          imageGenerationMode: body.imageGenerationMode,
          sourceImageCalibration: {
            count: sourceImageSummary.length,
            images: sourceImageSummary.slice(0, MAX_SOURCE_IMAGES_FOR_WRITER),
          },
          generatedImages: item.imageResolution.generatedImages.map((image) => ({
            fileId: image.fileId,
            storagePath: image.storagePath,
            visualType: image.visualType,
            sourceVisualTypes: image.sourceVisualTypes,
          })),
        },
        categoryIdByName,
      })
    ))

    if (!options.deferCompletion) {
      await updateGenerationRun({
        client,
        runId,
        status: 'completed',
        acceptedStemCount: stems.length,
        discardedStemCount: discarded.length + failedCallCount,
        debug,
      })
    }
    return { status: 200, payload: { stems, discardedCount: discarded.length + failedCallCount, debug, debugRunId: runId } }
  } catch (error) {
    await updateGenerationRun({
      client,
      runId: debug?.runId,
      status: 'failed',
      errorMessage: errorMessage(error),
      debug,
    })
    return { status: 500, payload: { error: errorMessage(error), debug, debugRunId: debug?.runId ?? null } }
  }
}
