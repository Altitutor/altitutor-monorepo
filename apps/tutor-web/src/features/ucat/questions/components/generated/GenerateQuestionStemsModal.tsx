'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { Json } from '@altitutor/shared'
import { Copy } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  SearchableSelect,
  Spinner,
  Switch,
  Textarea,
  useToast,
} from '@altitutor/ui'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import {
  useStartUcatQuestionGeneration,
  useImportGeneratedUcatQuestionStems,
  useUcatCategories,
  useUcatGenerationModelProfiles,
  useUcatQuestionDetail,
  useUcatSections,
  useUcatStemCatalog,
  useUcatTags,
  type UcatStemCatalogItem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import type {
  UcatGenerationDebugInfo,
  UcatGenerationProgress,
} from '@/features/ucat/questions/api/questions'
import {
  UcatQuestionStemDialog,
  type CategoryOption,
  type TagOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { mapCategoriesToOptions, mapTagsToOptions, taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import { resolveRootSectionId } from '@/features/ucat/shared/lib/taxonomy-reparent'
import { buildStemCatalogFilterDefinitions } from '@/features/ucat/shared/lib/stem-catalog-filters'
import { Step3SetAnswers } from '@/features/ucat/questions/components/bulk-import/Step3SetAnswers'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import {
  UcatStemCatalogAddPanel,
  UcatStemCatalogLabel,
  UcatStemCatalogSidePanel,
} from '@/features/ucat/shared/components/ucat-stem-catalog-panel'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'
import { cn } from '@/shared/utils'

type GenerateQuestionStemsModalProps = {
  open: boolean
  onClose: () => void
  onStarted?: (runId: string) => void
}

type DraftWithMetadata = BulkImportStemDraft & {
  aiGenerationMetadata: Json | null
}

type DifficultyTarget = 'easy' | 'medium' | 'hard' | 'mixed'
type TimeBurdenTarget = 'low' | 'medium' | 'high' | 'mixed'
type SourceMode = 'none' | 'random' | 'selected'
type ImageGenerationMode = 'auto' | 'deterministic' | 'ai'

type SelectOption<TValue extends string> = {
  id: TValue
  label: string
}

const DIFFICULTY_OPTIONS: Array<SelectOption<DifficultyTarget>> = [
  { id: 'mixed', label: 'Mixed' },
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
]

const TIME_BURDEN_OPTIONS: Array<SelectOption<TimeBurdenTarget>> = [
  { id: 'mixed', label: 'Mixed' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]

const SOURCE_MODE_OPTIONS: Array<SelectOption<SourceMode>> = [
  { id: 'random', label: 'Random approved stems' },
  { id: 'selected', label: 'Manually choose source stems' },
  { id: 'none', label: 'No source examples' },
]

const IMAGE_GENERATION_MODE_OPTIONS: Array<SelectOption<ImageGenerationMode>> = [
  { id: 'auto', label: 'Auto' },
  { id: 'deterministic', label: 'Deterministic renderer' },
  { id: 'ai', label: 'AI-generated stem image' },
]

function toImportPayload(draft: DraftWithMetadata): Record<string, unknown> {
  const values = draft.values
  return {
    sectionId: values.sectionId,
    categoryId: values.categoryId ?? null,
    stemText: values.stemText,
    questions: values.questions.map((question, questionIndex) => ({
      index: questionIndex + 1,
      questionText: question.questionText,
      answerExplanation: question.answerExplanation ?? null,
      difficulty: question.difficulty ?? null,
      timeBurdenSeconds:
        question.timeBurdenSeconds && question.timeBurdenSeconds.trim().length > 0
          ? Number(question.timeBurdenSeconds)
          : null,
      questionType: question.questionType,
      tagIds: question.tagIds ?? [],
      sourceChannel: question.sourceChannel ?? 'ai_generation',
      aiGenerationMetadata: question.aiGenerationMetadata ?? draft.aiGenerationMetadata,
      options: question.options.map((option, optionIndex) => ({
        index: optionIndex + 1,
        answerText: option.answerText,
        answerExplanation: option.answerExplanation ?? null,
        isAnswer: option.isAnswer,
      })),
    })),
    aiGenerationMetadata: draft.aiGenerationMetadata,
  }
}

function metadataWarnings(metadata: Json | null): string[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  const warnings = (metadata as Record<string, unknown>).warnings
  return Array.isArray(warnings) ? warnings.filter((item): item is string => typeof item === 'string') : []
}

function formatDebugJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

const SOURCE_STEM_FILTER_KEYS = new Set(['question_tag_id', 'visibility', 'question_type'])
const GENERATION_STEP_LABELS: Record<UcatGenerationProgress['step'], string> = {
  setup: 'Setup',
  sources: 'Sources',
  generating: 'Model calls',
  gates: 'Validation',
  images: 'Images',
  drafts: 'Drafts',
}
const GENERATION_STEP_ORDER: UcatGenerationProgress['step'][] = ['setup', 'sources', 'generating', 'gates', 'images', 'drafts']

function GenerationDebugPanel({ debug }: { debug: UcatGenerationDebugInfo | null }) {
  if (!debug) return null

  const rawDebug = formatDebugJson(debug)

  return (
    <details className="rounded-md border p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Generation debug</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Saved to the database{debug.runId ? ` as run ${debug.runId}` : ''}. Expand to inspect prompts, raw responses, timings, and gate failures.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.preventDefault()
              void navigator.clipboard.writeText(rawDebug)
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy raw
          </Button>
        </div>
      </summary>
      <div className="mt-4 space-y-3">
      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div>Requested stems: {debug.requestedStemCount}</div>
        <div>Section: {debug.sectionName ?? '-'}</div>
        <div>Selected category: {debug.selectedCategoryName ?? 'Realistic category mix'}</div>
        <div>Prompt layers: {debug.promptLayerCount}</div>
        <div className="md:col-span-2">Source sample IDs: {debug.sourceSampleIds.join(', ') || '-'}</div>
      </div>
      {debug.gateIssues.length > 0 ? (
        <details className="rounded-md border p-3 text-sm" open>
          <summary className="cursor-pointer font-medium">Gate issues ({debug.gateIssues.length})</summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs">{formatDebugJson(debug.gateIssues)}</pre>
        </details>
      ) : null}
      <div className="space-y-3">
        {debug.calls.map((call) => (
          <details key={`${call.operation}-${call.stemIndex}-${call.durationMs}`} className="rounded-md border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              Stem {call.stemIndex + 1} · {call.status} · {Math.round(call.durationMs / 1000)}s · {call.categoryName ?? 'no category'}
            </summary>
            <div className="mt-3 space-y-3">
              {call.error ? <div className="text-destructive">{call.error}</div> : null}
              <div className="grid gap-2 md:grid-cols-2">
                <div>Model: {call.model ?? '-'}</div>
                <div>Finish reason: {call.response?.finishReason ?? '-'}</div>
                <div>Max tokens: {call.request.maxCompletionTokens}</div>
                <div>Timeout: {Math.round(call.request.timeoutMs / 1000)}s</div>
                <div>Provider sort: {call.request.providerSort ?? 'default'}</div>
                <div>Reasoning effort: {call.request.reasoningEffort ?? 'default'}</div>
                <div>Response chars: {call.response?.contentLength ?? 0}</div>
              </div>
              {call.parsedSummary ? (
                <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-xs">{formatDebugJson(call.parsedSummary)}</pre>
              ) : null}
              <details>
                <summary className="cursor-pointer">System prompt</summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{call.request.systemPrompt}</pre>
              </details>
              <details>
                <summary className="cursor-pointer">User prompt</summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{call.request.userPrompt}</pre>
              </details>
              <details>
                <summary className="cursor-pointer">Raw model response</summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                  {call.response?.content ?? 'No response captured'}
                </pre>
              </details>
              <details>
                <summary className="cursor-pointer">Usage</summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">{formatDebugJson(call.response?.usage ?? null)}</pre>
              </details>
            </div>
          </details>
        ))}
      </div>
      </div>
    </details>
  )
}

function GenerationProgressPanel({
  progress,
  elapsedSeconds,
  stemCount,
}: {
  progress: UcatGenerationProgress | null
  elapsedSeconds: number
  stemCount: number
}) {
  const activeStep = progress?.step ?? 'setup'
  const activeIndex = GENERATION_STEP_ORDER.indexOf(activeStep)
  const completed = progress?.completedStems ?? 0
  const total = progress?.totalStems ?? stemCount
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0

  return (
    <div className="w-full max-w-xl space-y-6 rounded-md border p-6">
      <div className="flex items-center gap-3">
        <Spinner size="md" />
        <div>
          <h2 className="font-semibold">Generating tutor-review drafts</h2>
          <p className="text-sm text-muted-foreground">
            {progress?.message ?? 'Starting generation run'}
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{completed} of {total} model call{total === 1 ? '' : 's'} finished</span>
          <span>Elapsed: {elapsedSeconds}s</span>
        </div>
      </div>
      <ol className="grid gap-2 text-sm">
        {GENERATION_STEP_ORDER.map((stepKey, index) => {
          const done = index < activeIndex
          const active = stepKey === activeStep
          return (
            <li
              key={stepKey}
              className={cn(
                'flex items-center justify-between rounded-md border px-3 py-2',
                done && 'bg-muted text-muted-foreground',
                active && 'border-primary'
              )}
            >
              <span>{GENERATION_STEP_LABELS[stepKey]}</span>
              <span className="text-xs text-muted-foreground">{done ? 'Done' : active ? 'Running' : 'Queued'}</span>
            </li>
          )
        })}
      </ol>
      {progress?.runId ? (
        <p className="text-xs text-muted-foreground">Debug run: {progress.runId}</p>
      ) : null}
    </div>
  )
}

export function GenerateQuestionStemsModal({ open, onClose, onStarted }: GenerateQuestionStemsModalProps) {
  const { toast } = useToast()
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const modelProfilesQuery = useUcatGenerationModelProfiles(open)
  const stemCatalogQuery = useUcatStemCatalog(open)
  const generateMutation = useStartUcatQuestionGeneration()
  const importMutation = useImportGeneratedUcatQuestionStems()

  const [step, setStep] = useState<'config' | 'generating' | 'review'>('config')
  const [sectionId, setSectionId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [modelProfileId, setModelProfileId] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState<SourceMode>('random')
  const [includeAiSourceStems, setIncludeAiSourceStems] = useState(false)
  const [imageGenerationMode, setImageGenerationMode] = useState<ImageGenerationMode>('auto')
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [targetTagIds, setTargetTagIds] = useState<string[]>([])
  const [difficultyTarget, setDifficultyTarget] = useState<DifficultyTarget>('mixed')
  const [timeBurdenTarget, setTimeBurdenTarget] = useState<TimeBurdenTarget>('mixed')
  const [runInstructions, setRunInstructions] = useState('')
  const [stemCount, setStemCount] = useState<number>(5)
  const [drafts, setDrafts] = useState<DraftWithMetadata[]>([])
  const [stemSearch, setStemSearch] = useState('')
  const [stemFilters, setStemFilters] = useState<Record<string, unknown[]>>({})
  const [viewingStemId, setViewingStemId] = useState<string | null>(null)
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [generationDebug, setGenerationDebug] = useState<UcatGenerationDebugInfo | null>(null)
  const [generationProgress, setGenerationProgress] = useState<UcatGenerationProgress | null>(null)
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)
  const isGeneratingRef = useRef(false)
  const allowNavigationRef = useRef(false)
  const ignoreNextPopStateRef = useRef(false)

  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data])
  const modelProfiles = modelProfilesQuery.data?.modelProfiles ?? []
  const maxRequestedStems = modelProfilesQuery.data?.settings.maxRequestedStems ?? 20
  const effectiveModelProfileId =
    modelProfileId ?? modelProfiles.find((profile) => profile.isDefault)?.id ?? modelProfiles[0]?.id ?? null
  const selectedSection = useMemo(
    () => sections.find((section) => (section.id ?? '') === sectionId) ?? null,
    [sections, sectionId]
  )

  const availableSourceStems = useMemo((): UcatStemCatalogItem[] => {
    const all = (stemCatalogQuery.data ?? []) as UcatStemCatalogItem[]
    return all.filter((stem) => {
      if (!stem.sectionId || stem.sectionId !== sectionId) return false
      if (categoryId && stem.categoryId !== categoryId) return false
      if (!includeAiSourceStems && stem.sourceChannel === 'ai_generation') return false
      return true
    })
  }, [stemCatalogQuery.data, sectionId, categoryId, includeAiSourceStems])

  const stemById = useMemo(() => {
    const map = new Map<string, UcatStemCatalogItem>()
    for (const stem of availableSourceStems) map.set(stem.id, stem)
    return map
  }, [availableSourceStems])

  const categoryOptions = useMemo(
    () =>
      mapCategoriesToOptions(categories)
        .filter((category) => !sectionId || category.ucat_section_id === sectionId)
        .map((category) => ({
          id: category.id ?? '',
          name: taxonomyDisplayLabel(category),
          label: taxonomyDisplayLabel(category),
        })),
    [categories, sectionId]
  )

  const tagOptions = useMemo(
    () => {
      const mappedTags = mapTagsToOptions(tags)
      const taxonomyRows = mappedTags.map((tag) => ({
        id: tag.id ?? '',
        parent_id: tag.parent_question_tag_id ?? null,
        section_id: tag.ucat_section_id ?? null,
      }))
      return mappedTags
        .filter((tag) => {
          if (!sectionId) return true
          return resolveRootSectionId(taxonomyRows, tag.id ?? '') === sectionId
        })
        .map((tag) => ({
          id: tag.id ?? '',
          name: taxonomyDisplayLabel(tag),
        }))
        .filter((tag) => tag.id)
    },
    [tags, sectionId]
  )

  const selectedTags = targetTagIds
    .map((id) => tagOptions.find((tag) => tag.id === id))
    .filter((tag): tag is { id: string; name: string } => !!tag)

  const sourceStemFilterDefinitions = useMemo(() => {
    const scopedSections = sectionId ? sections.filter((section) => section.id === sectionId) : sections
    return buildStemCatalogFilterDefinitions(
      scopedSections,
      categories,
      tagsQuery.data ?? [],
      stemFilters
    ).filter((definition) => SOURCE_STEM_FILTER_KEYS.has(definition.key))
  }, [sections, sectionId, categories, tagsQuery.data, stemFilters])

  const stemDialogCategories = useMemo(
    () => mapCategoriesToOptions(categories) as CategoryOption[],
    [categories]
  )
  const stemDialogTags = useMemo(
    () => mapTagsToOptions(tagsQuery.data ?? []) as TagOption[],
    [tagsQuery.data]
  )
  const viewingStemDetail = useUcatQuestionDetail(viewingStemId)

  const stepReady =
    sectionId.length > 0 &&
    !!effectiveModelProfileId &&
    stemCount > 0 &&
    stemCount <= maxRequestedStems &&
    (sourceMode !== 'selected' || selectedSourceIds.length > 0)

  const isBusy = generateMutation.isPending || importMutation.isPending
  const isGenerating = step === 'generating' && generateMutation.isPending
  const showSourceStemPicker = step === 'config' && sourceMode === 'selected'

  useEffect(() => {
    isGeneratingRef.current = isGenerating
  }, [isGenerating])

  useEffect(() => {
    const message = 'Question generation is still running. Leaving this page may interrupt active AI model calls. Leave anyway?'

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isGeneratingRef.current || allowNavigationRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        !isGeneratingRef.current ||
        allowNavigationRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return

      const destination = new URL(anchor.href, window.location.href)
      if (
        destination.origin === window.location.origin &&
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      if (!window.confirm(message)) return

      allowNavigationRef.current = true
      anchor.click()
    }

    const handlePopState = () => {
      if (ignoreNextPopStateRef.current) {
        ignoreNextPopStateRef.current = false
        return
      }
      if (!isGeneratingRef.current || allowNavigationRef.current) return
      if (window.confirm(message)) {
        allowNavigationRef.current = true
        return
      }
      ignoreNextPopStateRef.current = true
      window.history.forward()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    if (step !== 'generating') {
      setGenerationElapsedSeconds(0)
      return undefined
    }
    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      setGenerationElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [step])

  useEffect(() => {
    if (step !== 'review') {
      setActiveTextEditor(null)
    }
  }, [step])

  function resetState() {
    setStep('config')
    setSectionId('')
    setCategoryId(null)
    setModelProfileId(null)
    setSourceMode('random')
    setIncludeAiSourceStems(false)
    setSelectedSourceIds([])
    setTargetTagIds([])
    setDifficultyTarget('mixed')
    setTimeBurdenTarget('mixed')
    setRunInstructions('')
    setStemCount(5)
    setDrafts([])
    setStemSearch('')
    setStemFilters({})
    setViewingStemId(null)
    setGenerationError(null)
    setGenerationDebug(null)
    setGenerationProgress(null)
    setImageGenerationMode('auto')
    setActiveTextEditor(null)
  }

  async function handleGenerate() {
    if (!stepReady) return
    setGenerationError(null)
    setGenerationDebug(null)
    setGenerationProgress({
      step: 'setup',
      message: 'Preparing generation request',
      completedStems: 0,
      totalStems: stemCount,
    })
    setStep('generating')
    window.dispatchEvent(new CustomEvent('ucat-generation-starting', { detail: { totalStems: stemCount } }))
    onClose()
    try {
      const result = await generateMutation.mutateAsync({
        sectionId,
        categoryId,
        modelProfileId: effectiveModelProfileId,
        sourceMode,
        includeAiSourceStems,
        imageGenerationMode,
        sourceStemIds: sourceMode === 'selected' ? selectedSourceIds : [],
        stemCount,
        difficultyTarget,
        timeBurdenTarget,
        targetTagIds,
        runInstructions: runInstructions.trim() || null,
      })
      onStarted?.(result.runId)
      window.dispatchEvent(new CustomEvent('ucat-generation-started', { detail: { runId: result.runId } }))
      toast({
        title: 'Generation started',
        description: 'Track progress in the notifications tray.',
      })
      resetState()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate question stems'
      window.dispatchEvent(new CustomEvent('ucat-generation-start-failed', { detail: { message } }))
      setGenerationError(message)
      setStep('config')
      toast({
        title: 'Generation failed',
        description: message,
        variant: 'destructive',
      })
    }
  }

  async function handleImport() {
    if (drafts.length === 0) return
    try {
      await importMutation.mutateAsync({
        sectionId,
        stems: drafts.map(toImportPayload),
      })
      toast({
        title: 'Generated stems imported',
        description: `${drafts.length} stem${drafts.length === 1 ? '' : 's'} added to generated queue.`,
      })
      resetState()
      onClose()
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unable to import generated stems',
        variant: 'destructive',
      })
    }
  }

  function handleRequestClose() {
    if (isGenerating) {
      if (!window.confirm('Question generation is still running. Close this dialog? Generation will continue while you stay on this page.')) {
        return
      }
      onClose()
      return
    }
    if (isBusy) return
    if (
      step === 'review' &&
      drafts.length > 0 &&
      !window.confirm('Generated stems will be discarded. Close without importing?')
    ) {
      return
    }
    resetState()
    onClose()
  }

  function handleSave() {
    if (step === 'config') void handleGenerate()
    else void handleImport()
  }

  const subtitle =
    step === 'config'
      ? 'Build a structured generation brief. Passing candidates will be shown for tutor review.'
      : step === 'generating'
        ? 'Generating candidates, running gates, and preparing tutor-review drafts.'
      : 'Review warnings, edit candidates, then import to the generated queue.'

  const saveLabel =
    step === 'config'
      ? generateMutation.isPending
        ? 'Generating...'
        : 'Generate'
      : step === 'generating'
        ? 'Generating...'
      : importMutation.isPending
        ? 'Importing...'
        : 'Import to generated queue'

  const allWarnings = drafts.flatMap((draft) => metadataWarnings(draft.aiGenerationMetadata))

  return (
    <>
      <UcatDialogShell
        open={open}
        onClose={handleRequestClose}
        title="Generate questions"
        subtitle={subtitle}
        onSave={handleSave}
        saveLabel={saveLabel}
        saveDisabled={
          step === 'config'
            ? !stepReady || generateMutation.isPending
            : step === 'generating'
              ? true
            : drafts.length === 0 || importMutation.isPending
        }
        defaultExpanded
        richTextToolbarEditor={step === 'review' ? activeTextEditor : null}
      >
        {step === 'config' ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <section
              className={cn(
                'min-w-0 flex-1 space-y-6 overflow-y-auto px-6 py-4',
                showSourceStemPicker && 'border-r'
              )}
            >
              <section className="space-y-4 rounded-md border p-4">
                <div>
                  <h2 className="font-semibold">Question settings</h2>
                </div>
                {generationError ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {generationError}
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Section</Label>
                    <SearchableSelect<(typeof sections)[number]>
                      items={sections}
                      value={selectedSection}
                      onValueChange={(section) => {
                        if (!section?.id) return
                        setSectionId(section.id)
                        setCategoryId(null)
                        setSelectedSourceIds([])
                        setTargetTagIds([])
                        setStemSearch('')
                        setStemFilters({})
                      }}
                      getItemLabel={(section) => section.name ?? 'Untitled section'}
                      getItemId={(section) => section.id ?? 'none'}
                      placeholder={sections.length > 0 ? 'Select a section' : 'No sections available'}
                      searchPlaceholder="Search sections..."
                      emptyMessage="No sections found"
                      disabled={sections.length === 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stem category</Label>
                    <SearchableSelect<{ id: string; name: string }>
                      items={categoryOptions}
                      value={categoryOptions.find((item) => item.id === categoryId) ?? null}
                      onValueChange={(value) => {
                        setCategoryId(value?.id ?? null)
                        setSelectedSourceIds([])
                      }}
                      getItemId={(item) => item.id}
                      getItemLabel={(item) => taxonomyDisplayLabel(item)}
                      placeholder="Realistic category mix"
                      searchPlaceholder="Search categories..."
                      emptyMessage="No categories found"
                      disabled={!sectionId}
                      allowClear
                      clearLabel="Realistic category mix"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Number of stems</Label>
                    <Input
                      type="number"
                      min={1}
                      max={maxRequestedStems}
                      value={stemCount}
                      onChange={(event) => {
                        const next = Number.parseInt(event.target.value || '1', 10)
                        setStemCount(Number.isFinite(next) ? Math.max(1, Math.min(maxRequestedStems, next)) : 1)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Difficulty target</Label>
                    <SearchableSelect<SelectOption<DifficultyTarget>>
                      items={DIFFICULTY_OPTIONS}
                      value={DIFFICULTY_OPTIONS.find((item) => item.id === difficultyTarget) ?? null}
                      onValueChange={(value) => {
                        if (value) setDifficultyTarget(value.id)
                      }}
                      getItemId={(item) => item.id}
                      getItemLabel={(item) => item.label}
                      searchPlaceholder="Search difficulty..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time burden target</Label>
                    <SearchableSelect<SelectOption<TimeBurdenTarget>>
                      items={TIME_BURDEN_OPTIONS}
                      value={TIME_BURDEN_OPTIONS.find((item) => item.id === timeBurdenTarget) ?? null}
                      onValueChange={(value) => {
                        if (value) setTimeBurdenTarget(value.id)
                      }}
                      getItemId={(item) => item.id}
                      getItemLabel={(item) => item.label}
                      searchPlaceholder="Search time burden..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Target tags</Label>
                    <SearchableSelect<{ id: string; name: string }>
                      items={tagOptions.filter((tag) => !targetTagIds.includes(tag.id))}
                      value={null}
                      onValueChange={(value) => {
                        if (value?.id && !targetTagIds.includes(value.id)) setTargetTagIds((prev) => [...prev, value.id])
                      }}
                      getItemId={(item) => item.id}
                      getItemLabel={(item) => item.name}
                      placeholder="Add tag"
                      searchPlaceholder="Search tags..."
                      emptyMessage="No tags found"
                      disabled={!sectionId || tagOptions.length === 0}
                    />
                  </div>
                </div>
                {selectedTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map((tag) => (
                      <Button
                        key={tag.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setTargetTagIds((prev) => prev.filter((id) => id !== tag.id))}
                      >
                        {tag.name} ×
                      </Button>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="space-y-4 rounded-md border p-4">
                <div>
                  <h2 className="font-semibold">AI settings</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Model profile</Label>
                    <SearchableSelect<(typeof modelProfiles)[number]>
                      items={modelProfiles}
                      value={modelProfiles.find((profile) => profile.id === effectiveModelProfileId) ?? null}
                      onValueChange={(profile) => setModelProfileId(profile?.id ?? null)}
                      getItemId={(profile) => profile.id}
                      getItemLabel={(profile) => `${profile.name} (${profile.model})`}
                      placeholder={modelProfilesQuery.isLoading ? 'Loading models...' : 'Select model'}
                      searchPlaceholder="Search models..."
                      emptyMessage="No model profiles found"
                      loading={modelProfilesQuery.isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Source examples</Label>
                    <SearchableSelect<SelectOption<SourceMode>>
                      items={SOURCE_MODE_OPTIONS}
                      value={SOURCE_MODE_OPTIONS.find((item) => item.id === sourceMode) ?? null}
                      onValueChange={(value) => {
                        if (!value) return
                        setSourceMode(value.id)
                        setSelectedSourceIds([])
                        setStemSearch('')
                        setStemFilters({})
                        if (value.id === 'none') setIncludeAiSourceStems(false)
                      }}
                      getItemId={(item) => item.id}
                      getItemLabel={(item) => item.label}
                      searchPlaceholder="Search source modes..."
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
                    <Label htmlFor="include-ai-source-stems" className="text-sm font-medium">
                      Include AI-generated source stems
                    </Label>
                    <Switch
                      id="include-ai-source-stems"
                      checked={includeAiSourceStems}
                      disabled={sourceMode === 'none'}
                      onCheckedChange={(checked) => {
                        setIncludeAiSourceStems(checked)
                        setSelectedSourceIds([])
                      }}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Image generation</Label>
                    <SearchableSelect<SelectOption<ImageGenerationMode>>
                      items={IMAGE_GENERATION_MODE_OPTIONS}
                      value={IMAGE_GENERATION_MODE_OPTIONS.find((item) => item.id === imageGenerationMode) ?? null}
                      onValueChange={(value) => {
                        if (value) setImageGenerationMode(value.id)
                      }}
                      getItemId={(item) => item.id}
                      getItemLabel={(item) => item.label}
                      searchPlaceholder="Search image modes..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Auto uses AI for stem-level QR source images when an image API is configured, and deterministic rendering for DM set/logical diagrams.
                    </p>
                  </div>
                </div>

                {showSourceStemPicker ? (
                <div className="space-y-3">
                  <div>
                    <h2 className="font-semibold">Selected source stems</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Source stems calibrate style only. Generated candidates are checked for clone risk.
                    </p>
                  </div>
                  {selectedSourceIds.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No source stems selected yet.</p>
                  ) : (
                    <UcatSortableList
                      ids={selectedSourceIds}
                      onChange={setSelectedSourceIds}
                      onRemove={(id) => setSelectedSourceIds((prev) => prev.filter((stemId) => stemId !== id))}
                      renderLabel={(id, index) => (
                        <UcatStemCatalogLabel stem={stemById.get(id)} id={id} index={index} />
                      )}
                    />
                  )}
                </div>
                ) : null}

                <div className="space-y-2">
                  <Label>Run instructions</Label>
                  <Textarea
                    className="min-h-24"
                    value={runInstructions}
                    onChange={(event) => setRunInstructions(event.target.value)}
                    placeholder="One-off notes for this generation run"
                  />
                </div>
              </section>
              <GenerationDebugPanel debug={generationDebug} />
            </section>

            <UcatStemCatalogSidePanel open={showSourceStemPicker}>
              <UcatStemCatalogAddPanel
                stems={availableSourceStems}
                excludedIds={selectedSourceIds}
                search={stemSearch}
                onSearchChange={setStemSearch}
                filters={stemFilters}
                onFiltersChange={setStemFilters}
                filterDefinitions={sourceStemFilterDefinitions}
                onAddStem={(stemId) => setSelectedSourceIds((prev) => [...prev, stemId])}
                onViewStem={setViewingStemId}
                searchPlaceholder="Search stems or questions"
                emptyMessage={
                  !sectionId
                    ? 'Select a section to browse approved stems.'
                    : availableSourceStems.length === 0
                      ? 'No approved stems for this section/category.'
                      : 'No stems to add, or all matching stems are already selected.'
                }
                className="min-h-0 flex-1"
              />
            </UcatStemCatalogSidePanel>
          </div>
        ) : step === 'generating' ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-10">
            <GenerationProgressPanel
              progress={generationProgress}
              elapsedSeconds={generationElapsedSeconds}
              stemCount={stemCount}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {allWarnings.length > 0 ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <div className="font-medium">{allWarnings.length} generation warning{allWarnings.length === 1 ? '' : 's'}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {allWarnings.slice(0, 6).map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Step3SetAnswers
              stems={drafts}
              categories={categories}
              tags={stemDialogTags}
              sections={sections.map((s) => ({
                id: s.id,
                name: s.name,
                display_columns: s.display_columns,
              }))}
              onUpdateStem={(stemId, values) =>
                setDrafts((prev) =>
                  prev.map((draft) => (draft.id === stemId ? { ...draft, values } : draft))
                )
              }
              sourceChannel="ai_generation"
              onActiveTextEditorChange={setActiveTextEditor}
            />
            <GenerationDebugPanel debug={generationDebug} />
          </div>
        )}
      </UcatDialogShell>

      <UcatQuestionStemDialog
        open={!!viewingStemId}
        title="View Question Stem"
        submitLabel="Save"
        onClose={() => setViewingStemId(null)}
        onSubmit={async () => undefined}
        sections={sections.map((section) => ({
          id: section.id,
          name: section.name,
          display_columns: section.display_columns,
        }))}
        categories={stemDialogCategories}
        tags={stemDialogTags}
        initial={viewingStemDetail.data}
        loading={viewingStemDetail.isLoading}
        initialEditorMode="view"
        readOnly
      />
    </>
  )
}
