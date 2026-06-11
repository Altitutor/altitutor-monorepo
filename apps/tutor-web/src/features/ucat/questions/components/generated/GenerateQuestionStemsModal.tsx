'use client'

import { useMemo, useState } from 'react'
import type { DataTableFilterDefinition, Json } from '@altitutor/shared'
import {
  Input,
  Label,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@altitutor/ui'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import {
  useGenerateUcatQuestionDrafts,
  useImportGeneratedUcatQuestionStems,
  useUcatCategories,
  useUcatSections,
  useUcatStemCatalog,
  type UcatStemCatalogItem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { mapCategoriesToOptions, taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
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
      timeBurdenSeconds:
        question.timeBurdenSeconds != null ? String(question.timeBurdenSeconds) : '',
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

const SOURCE_STEM_FILTER_DEFINITIONS: DataTableFilterDefinition[] = [
  {
    key: 'visibility',
    label: 'Visibility',
    options: [
      { label: 'Public', value: 'public' },
      { label: 'Private', value: 'private' },
    ],
  },
  {
    key: 'question_type',
    label: 'Type',
    options: [
      { label: 'Multiple Choice', value: 'multiple_choice' },
      { label: 'Syllogism', value: 'syllogism' },
    ],
  },
]

export function GenerateQuestionStemsModal({ open, onClose }: GenerateQuestionStemsModalProps) {
  const { toast } = useToast()
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const stemCatalogQuery = useUcatStemCatalog(open)
  const generateMutation = useGenerateUcatQuestionDrafts()
  const importMutation = useImportGeneratedUcatQuestionStems()

  const [step, setStep] = useState<'config' | 'review'>('config')
  const [sectionId, setSectionId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState<'random' | 'selected'>('random')
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [stemCount, setStemCount] = useState<number>(5)
  const [drafts, setDrafts] = useState<DraftWithMetadata[]>([])
  const [stemSearch, setStemSearch] = useState('')
  const [stemFilters, setStemFilters] = useState<Record<string, unknown[]>>({})

  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
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
    for (const stem of availableSourceStems) {
      map.set(stem.id, stem)
    }
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

  const stepReady =
    sectionId.length > 0 &&
    stemCount > 0 &&
    stemCount <= 50 &&
    (sourceMode === 'random' || selectedSourceIds.length > 0)

  const isBusy = generateMutation.isPending || importMutation.isPending
  const showSourceStemPicker = step === 'config' && sourceMode === 'selected'

  function resetState() {
    setStep('config')
    setSectionId('')
    setCategoryId(null)
    setSourceMode('random')
    setSelectedSourceIds([])
    setStemCount(5)
    setDrafts([])
    setStemSearch('')
    setStemFilters({})
  }

  async function handleGenerate() {
    if (!stepReady) return
    try {
      const result = await generateMutation.mutateAsync({
        sectionId,
        categoryId,
        sourceMode,
        sourceStemIds: sourceMode === 'selected' ? selectedSourceIds : [],
        stemCount,
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
    if (step === 'config') {
      void handleGenerate()
      return
    }
    void handleImport()
  }

  const subtitle =
    step === 'config'
      ? 'Choose section/category and source stems for AI generation.'
      : 'Review and edit generated stems before importing to the generated queue.'

  const saveLabel =
    step === 'config'
      ? generateMutation.isPending
        ? 'Generating...'
        : 'Generate'
      : importMutation.isPending
        ? 'Importing...'
        : 'Import to generated queue'

  return (
    <UcatDialogShell
      open={open}
      onClose={handleRequestClose}
      title="Generate questions"
      subtitle={subtitle}
      onSave={handleSave}
      saveLabel={saveLabel}
      saveDisabled={
        step === 'config' ? !stepReady || generateMutation.isPending : drafts.length === 0 || importMutation.isPending
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
                <Label>Category (optional)</Label>
                <SearchableSelect<{ id: string; name: string }>
                  items={categoryOptions}
                  value={categoryOptions.find((item) => item.id === categoryId) ?? null}
                  onValueChange={(value) => {
                    setCategoryId(value?.id ?? null)
                    setSelectedSourceIds([])
                  }}
                  getItemId={(item) => item.id}
                  getItemLabel={(item) => taxonomyDisplayLabel(item)}
                  placeholder="All categories"
                  searchPlaceholder="Search categories..."
                  emptyMessage="No categories found"
                  allowClear
                  clearLabel="All categories"
                  disabled={!sectionId}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Source mode</Label>
              <Select
                value={sourceMode}
                onValueChange={(value) => {
                  setSourceMode(value as 'random' | 'selected')
                  setSelectedSourceIds([])
                  setStemSearch('')
                  setStemFilters({})
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Choose random approved stems</SelectItem>
                  <SelectItem value="selected">Manually choose source stems</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showSourceStemPicker ? (
              <div className="space-y-3">
                <div>
                  <h2 className="font-semibold">Selected source stems</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Approved stems to use as generation references. Add stems from the panel on the right.
                  </p>
                </div>
                {selectedSourceIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No source stems selected yet.</p>
                ) : (
                  <UcatSortableList
                    ids={selectedSourceIds}
                    onChange={setSelectedSourceIds}
                    onRemove={(id) =>
                      setSelectedSourceIds((prev) => prev.filter((stemId) => stemId !== id))
                    }
                    renderLabel={(id, index) => (
                      <UcatStemCatalogLabel stem={stemById.get(id)} id={id} index={index} />
                    )}
                  />
                )}
              </div>
            ) : null}

            <div className="max-w-40 space-y-2">
              <Label>Number of stems</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={stemCount}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value || '1', 10)
                  setStemCount(Number.isFinite(next) ? Math.max(1, Math.min(50, next)) : 1)
                }}
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
              filterDefinitions={SOURCE_STEM_FILTER_DEFINITIONS}
              onAddStem={(stemId) => setSelectedSourceIds((prev) => [...prev, stemId])}
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
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
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
  )
}
