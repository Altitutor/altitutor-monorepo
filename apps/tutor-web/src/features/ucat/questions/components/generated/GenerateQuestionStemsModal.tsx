'use client'

import { useMemo, useState } from 'react'
import type { Json } from '@altitutor/shared'
import {
  Button,
  Input,
  Label,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from '@altitutor/ui'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import {
  useGenerateUcatQuestionDrafts,
  useImportGeneratedUcatQuestionStems,
  useUcatCategories,
  useUcatGenerationProfiles,
  useUcatQuestionDetail,
  useUcatSections,
  useUcatStemCatalog,
  useUcatTags,
  type UcatStemCatalogItem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  UcatQuestionStemDialog,
  type CategoryOption,
  type TagOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { mapCategoriesToOptions, mapTagsToOptions, taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import { buildStemCatalogFilterDefinitions } from '@/features/ucat/shared/lib/stem-catalog-filters'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
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
}

type DraftWithMetadata = BulkImportStemDraft & {
  aiGenerationMetadata: Json | null
}

type DifficultyTarget = 'easy' | 'medium' | 'hard' | 'mixed'
type TimeBurdenTarget = 'low' | 'medium' | 'high' | 'mixed'
type SourceMode = 'none' | 'random' | 'selected'

function toFormValues(stem: {
  sectionId: string
  categoryId: string | null
  stemText: Json
  isPrivate: boolean
  questions: Array<{
    questionText: Json
    answerExplanation: Json | null
    difficulty: number | null
    timeBurdenSeconds: number | null
    questionType: 'multiple_choice' | 'syllogism'
    tagIds: string[]
    options: Array<{
      answerText: Json
      answerExplanation: Json | null
      isAnswer: boolean
    }>
  }>
}): UcatQuestionStemFormValues {
  return {
    sectionId: stem.sectionId,
    categoryId: stem.categoryId,
    stemText: stem.stemText,
    isPrivate: true,
    questions: stem.questions.map((question) => ({
      questionText: question.questionText,
      questionType: question.questionType,
      answerExplanation: question.answerExplanation,
      difficulty: question.difficulty,
      timeBurdenSeconds: question.timeBurdenSeconds != null ? String(question.timeBurdenSeconds) : '',
      tagIds: question.tagIds ?? [],
      options: question.options.map((option) => ({
        answerText: option.answerText,
        answerExplanation: option.answerExplanation,
        isAnswer: option.isAnswer,
      })),
    })),
  }
}

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

const SOURCE_STEM_FILTER_KEYS = new Set(['question_tag_id', 'visibility', 'question_type'])

export function GenerateQuestionStemsModal({ open, onClose }: GenerateQuestionStemsModalProps) {
  const { toast } = useToast()
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const profilesQuery = useUcatGenerationProfiles(open)
  const stemCatalogQuery = useUcatStemCatalog(open)
  const generateMutation = useGenerateUcatQuestionDrafts()
  const importMutation = useImportGeneratedUcatQuestionStems()

  const [step, setStep] = useState<'config' | 'review'>('config')
  const [sectionId, setSectionId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState<SourceMode>('none')
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

  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data])
  const profiles = profilesQuery.data?.profiles ?? []
  const maxRequestedStems = profilesQuery.data?.settings.maxRequestedStems ?? 20
  const effectiveProfileId = profileId ?? profiles.find((profile) => profile.isDefault)?.id ?? profiles[0]?.id ?? null
  const selectedSection = useMemo(
    () => sections.find((section) => (section.id ?? '') === sectionId) ?? null,
    [sections, sectionId]
  )

  const availableSourceStems = useMemo((): UcatStemCatalogItem[] => {
    const all = (stemCatalogQuery.data ?? []) as UcatStemCatalogItem[]
    return all.filter((stem) => {
      if (!stem.sectionId || stem.sectionId !== sectionId) return false
      if (categoryId && stem.categoryId !== categoryId) return false
      return true
    })
  }, [stemCatalogQuery.data, sectionId, categoryId])

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
    () =>
      mapTagsToOptions(tags)
        .filter((tag) => {
          if (!sectionId) return true
          const section = (tag as { ucat_section_id?: string | null }).ucat_section_id
          return !section || section === sectionId
        })
        .map((tag) => ({
          id: tag.id ?? '',
          name: taxonomyDisplayLabel(tag),
        }))
        .filter((tag) => tag.id),
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
    !!categoryId &&
    !!effectiveProfileId &&
    stemCount > 0 &&
    stemCount <= maxRequestedStems &&
    (sourceMode !== 'selected' || selectedSourceIds.length > 0)

  const isBusy = generateMutation.isPending || importMutation.isPending
  const showSourceStemPicker = step === 'config' && sourceMode === 'selected'

  function resetState() {
    setStep('config')
    setSectionId('')
    setCategoryId(null)
    setProfileId(null)
    setSourceMode('none')
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
  }

  async function handleGenerate() {
    if (!stepReady) return
    try {
      const result = await generateMutation.mutateAsync({
        sectionId,
        categoryId,
        profileId: effectiveProfileId,
        sourceMode,
        sourceStemIds: sourceMode === 'selected' ? selectedSourceIds : [],
        stemCount,
        difficultyTarget,
        timeBurdenTarget,
        targetTagIds,
        runInstructions: runInstructions.trim() || null,
      })
      const nextDrafts: DraftWithMetadata[] = result.stems.map((stem, index) => ({
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `generated-${index + 1}`,
        values: toFormValues(stem),
        aiGenerationMetadata: stem.aiGenerationMetadata,
      }))
      setDrafts(nextDrafts)
      setStep('review')
      if (result.discardedCount && result.discardedCount > 0) {
        toast({
          title: 'Some candidates were discarded',
          description: `${result.discardedCount} internal candidate${result.discardedCount === 1 ? '' : 's'} failed blocking gates.`,
        })
      }
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Unable to generate question stems',
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
      : 'Review warnings, edit candidates, then import to the generated queue.'

  const saveLabel =
    step === 'config'
      ? generateMutation.isPending
        ? 'Generating...'
        : 'Generate'
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
            : drafts.length === 0 || importMutation.isPending
        }
        defaultExpanded
      >
        {step === 'config' ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <section
              className={cn(
                'min-w-0 flex-1 space-y-6 overflow-y-auto px-6 py-4',
                showSourceStemPicker && 'border-r'
              )}
            >
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
                    placeholder="Select a category"
                    searchPlaceholder="Search categories..."
                    emptyMessage="No categories found"
                    disabled={!sectionId}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Generation profile</Label>
                  <Select value={effectiveProfileId ?? ''} onValueChange={setProfileId}>
                    <SelectTrigger>
                      <SelectValue placeholder={profilesQuery.isLoading ? 'Loading profiles...' : 'Select profile'} />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.model})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select value={difficultyTarget} onValueChange={(value) => setDifficultyTarget(value as DifficultyTarget)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mixed">Mixed</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time burden target</Label>
                  <Select value={timeBurdenTarget} onValueChange={(value) => setTimeBurdenTarget(value as TimeBurdenTarget)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mixed">Mixed</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Target tags (optional)</Label>
                <div className="flex gap-2">
                  <select
                    className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                    value=""
                    disabled={!sectionId || tagOptions.length === 0}
                    onChange={(event) => {
                      const value = event.target.value
                      if (value && !targetTagIds.includes(value)) setTargetTagIds((prev) => [...prev, value])
                    }}
                  >
                    <option value="">Add tag...</option>
                    {tagOptions
                      .filter((tag) => !targetTagIds.includes(tag.id))
                      .map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                  </select>
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
              </div>

              <div className="space-y-2">
                <Label>Source examples</Label>
                <Select
                  value={sourceMode}
                  onValueChange={(value) => {
                    setSourceMode(value as SourceMode)
                    setSelectedSourceIds([])
                    setStemSearch('')
                    setStemFilters({})
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No source examples</SelectItem>
                    <SelectItem value="random">Random approved stems</SelectItem>
                    <SelectItem value="selected">Manually choose source stems</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label>Run instructions (optional)</Label>
                <Textarea
                  className="min-h-24"
                  value={runInstructions}
                  onChange={(event) => setRunInstructions(event.target.value)}
                  placeholder="One-off notes for this generation run"
                />
              </div>
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
                title="Add source stems"
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
              sections={sections.map((s) => ({ id: s.id, display_columns: s.display_columns }))}
              onUpdateStem={(stemId, values) =>
                setDrafts((prev) =>
                  prev.map((draft) => (draft.id === stemId ? { ...draft, values } : draft))
                )
              }
            />
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
