'use client'

import { useMemo, useState } from 'react'
import type { Json } from '@altitutor/shared'
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { mapCategoriesToOptions, taxonomyDisplayLabel } from '@/features/ucat/shared/lib/taxonomy-paths'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { Step3SetAnswers } from '@/features/ucat/questions/components/bulk-import/Step3SetAnswers'

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

  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])

  const availableSourceStems = useMemo(() => {
    const all = stemCatalogQuery.data ?? []
    return all.filter((stem) => {
      if (!stem.sectionId || stem.sectionId !== sectionId) return false
      if (categoryId && stem.categoryId !== categoryId) return false
      return true
    })
  }, [stemCatalogQuery.data, sectionId, categoryId])

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

  function resetState() {
    setStep('config')
    setSectionId('')
    setCategoryId(null)
    setSourceMode('random')
    setSelectedSourceIds([])
    setStemCount(5)
    setDrafts([])
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

  function handleClose(nextOpen: boolean) {
    if (nextOpen) return
    if (generateMutation.isPending || importMutation.isPending) return
    resetState()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full md:max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <div className="border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle>Generate questions</DialogTitle>
            <DialogDescription>
              {step === 'config'
                ? 'Choose section/category and source stems for AI generation.'
                : 'Review and edit generated stems before importing to the generated queue.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 'config' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select
                    value={sectionId}
                    onValueChange={(value) => {
                      setSectionId(value)
                      setCategoryId(null)
                      setSelectedSourceIds([])
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((section) => (
                        <SelectItem key={section.id ?? ''} value={section.id ?? ''}>
                          {section.name ?? 'Untitled'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category (optional)</Label>
                  <SearchableSelect<{ id: string; name: string }>
                    items={categoryOptions}
                    value={categoryOptions.find((item) => item.id === categoryId) ?? null}
                    onValueChange={(value) => setCategoryId(value?.id ?? null)}
                    getItemId={(item) => item.id}
                    getItemLabel={(item) => taxonomyDisplayLabel(item)}
                    placeholder="All categories"
                    searchPlaceholder="Search categories..."
                    emptyMessage="No categories found"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Source mode</Label>
                <Select value={sourceMode} onValueChange={(value) => setSourceMode(value as 'random' | 'selected')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Choose random approved stems</SelectItem>
                    <SelectItem value="selected">Manually choose source stems</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {sourceMode === 'selected' && (
                <div className="space-y-2">
                  <Label>Source stems (approved only)</Label>
                  <div className="max-h-64 overflow-y-auto rounded border p-2 space-y-1">
                    {availableSourceStems.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-2 py-2">
                        No approved stems for this section/category.
                      </p>
                    ) : (
                      availableSourceStems.map((stem) => {
                        const checked = selectedSourceIds.includes(stem.id)
                        return (
                          <label key={stem.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/40">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) => {
                                setSelectedSourceIds((prev) =>
                                  next
                                    ? [...prev, stem.id]
                                    : prev.filter((id) => id !== stem.id)
                                )
                              }}
                            />
                            <span className="text-sm truncate">{stem.text || '(No text)'}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2 max-w-40">
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
            </div>
          ) : (
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
          )}
        </div>

        <div className="border-t px-6 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 'review') {
                setStep('config')
                return
              }
              resetState()
              onClose()
            }}
            disabled={generateMutation.isPending || importMutation.isPending}
          >
            {step === 'review' ? 'Back' : 'Cancel'}
          </Button>
          {step === 'config' ? (
            <Button onClick={() => void handleGenerate()} disabled={!stepReady || generateMutation.isPending}>
              {generateMutation.isPending ? 'Generating...' : 'Generate'}
            </Button>
          ) : (
            <Button onClick={() => void handleImport()} disabled={drafts.length === 0 || importMutation.isPending}>
              {importMutation.isPending ? 'Importing...' : 'Import to generated queue'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
