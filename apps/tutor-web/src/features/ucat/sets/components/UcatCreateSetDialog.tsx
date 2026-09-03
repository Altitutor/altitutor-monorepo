'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Badge,
  Button,
  Input,
  SearchableSelect,
  Switch,
  Textarea,
  useToast,
} from '@altitutor/ui'
import {
  useUcatCategories,
  useUcatStemCatalog,
  type UcatStemCatalogItem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useUcatSections } from '@/features/ucat/sections/hooks/useUcatSections'
import { useCreateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import { UcatSetPropertyRow } from '@/features/ucat/sets/components/UcatSetPropertyRow'
import { UcatSetTimeLimitFields } from '@/features/ucat/sets/components/UcatSetTimeLimitFields'
import {
  blueprintCategoryRanges,
  blueprintPreferredCategoryTargets,
  buildAutoSetPreviewAsync,
  parseCategoryRange,
  positiveIntFromInput,
  type AutoCategoryRangeInput,
  type AutoCategoryRow,
  type AutoSetMode,
  type AutoSetPreview,
  type AutoStemVisibility,
} from '@/features/ucat/sets/lib/auto-set-builder'
import {
  PACED_SPEED_DEFAULT,
  isSetTimeLimitValid,
  resolveSetTimeLimitSeconds,
  type SetTimeLimitSource,
} from '@/features/ucat/sets/lib/set-time-limit'
import { UcatBlueprintCompliancePanel } from '@/features/ucat/mocks/components/UcatBlueprintCompliancePanel'
import { blueprintRowToModel, blueprintSectionCode } from '@/features/ucat/mocks/lib/blueprint-compliance'
import { useUcatMockBlueprints } from '@/features/ucat/mocks/hooks/useUcatMocks'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatVisibilityFieldLabel } from '@/features/ucat/shared/components/UcatVisibilityInfoTooltip'
import { lifecycleErrorToast, type UcatLifecycleEntityType } from '@/features/ucat/shared/lifecycle-errors'
import type { UcatQuestionSetFormat, UcatQuestionSetPayload } from '@/features/ucat/shared/types'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import { cn } from '@/shared/utils'

const AUTO_MODE_OPTIONS: Array<{ value: AutoSetMode; label: string }> = [
  { value: 'total', label: 'Total only' },
  { value: 'category', label: 'By category' },
  { value: 'range', label: 'Total + category ranges' },
]

const STEM_VISIBILITY_OPTIONS: Array<{ value: AutoStemVisibility; label: string }> = [
  { value: 'either', label: 'Either' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
]

const SET_FORMAT_OPTIONS: Array<{ value: UcatQuestionSetFormat; label: string }> = [
  { value: 'full_section', label: 'Full section' },
  { value: 'partial_section', label: 'Partial section' },
]

const EMPTY_EXISTING_STEMS: UcatStemCatalogItem[] = []

type UcatCreateSetDialogProps = {
  open: boolean
  initialSectionId?: string | null
  initialSetFormat?: UcatQuestionSetFormat
  initialReferenceBlueprintId?: string | null
  variant?: 'create' | 'fill'
  existingStems?: UcatStemCatalogItem[]
  onClose: () => void
  onCreated: (setId: string, name: string) => void
  onFilled?: (stemIds: string[]) => void
  onOpenLifecycleEntity: (entityType: UcatLifecycleEntityType, entityId: string) => boolean
}

export function UcatCreateSetDialog({
  open,
  initialSectionId = null,
  initialSetFormat = 'full_section',
  initialReferenceBlueprintId = null,
  variant = 'create',
  existingStems = EMPTY_EXISTING_STEMS,
  onClose,
  onCreated,
  onFilled,
  onOpenLifecycleEntity,
}: UcatCreateSetDialogProps) {
  const { toast } = useToast()
  const router = useRouter()
  const createSet = useCreateUcatSet()
  const sectionsQuery = useUcatSections()
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const categoriesQuery = useUcatCategories()
  const blueprintsQuery = useUcatMockBlueprints()

  const [authoringNote, setAuthoringNote] = useState('')
  const [description, setDescription] = useState('')
  const [setFormat, setSetFormat] = useState<UcatQuestionSetFormat>(initialSetFormat)
  const [timeLimitSource, setTimeLimitSource] = useState<SetTimeLimitSource>('paced')
  const [timeLimitSpeed, setTimeLimitSpeed] = useState(PACED_SPEED_DEFAULT)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('')
  const [timeLimitSeconds, setTimeLimitSeconds] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [autoCriteriaEnabled, setAutoCriteriaEnabled] = useState(variant === 'fill')
  const [autoSectionId, setAutoSectionId] = useState<string | null>(initialSectionId)
  const [autoMode, setAutoMode] = useState<AutoSetMode>('range')
  const [autoBlueprintId, setAutoBlueprintId] = useState<string | null>(initialReferenceBlueprintId)
  const [autoTargetTotal, setAutoTargetTotal] = useState('')
  const [autoCategoryTargets, setAutoCategoryTargets] = useState<Record<string, string>>({})
  const [autoCategoryRanges, setAutoCategoryRanges] = useState<Record<string, AutoCategoryRangeInput>>({})
  const [autoStemVisibility, setAutoStemVisibility] = useState<AutoStemVisibility>('public')
  const [autoOnlyNotInAnotherSet, setAutoOnlyNotInAnotherSet] = useState(true)
  const [autoSeed, setAutoSeed] = useState(1)
  const [autoPreview, setAutoPreview] = useState<AutoSetPreview | null>(null)
  const [autoPreviewLoading, setAutoPreviewLoading] = useState(false)

  const stemCatalogQuery = useUcatStemCatalog(open && autoCriteriaEnabled, {
    publishedOnly: true,
    lite: true,
  })
  const stemCatalog = useMemo(() => {
    const byId = new Map<string, UcatStemCatalogItem>(
      (stemCatalogQuery.data ?? []).map((stem) => [stem.id, stem]),
    )
    for (const stem of existingStems) byId.set(stem.id, stem)
    return [...byId.values()]
  }, [existingStems, stemCatalogQuery.data])
  const existingStemIds = useMemo(() => existingStems.map((stem) => stem.id), [existingStems])
  const stemCatalogLoading =
    stemCatalogQuery.isPending ||
    (stemCatalogQuery.isFetching && stemCatalogQuery.isStale)
  const stemCatalogError =
    stemCatalogQuery.isError
      ? stemCatalogQuery.error instanceof Error
        ? stemCatalogQuery.error.message
        : 'Failed to load eligible stems.'
      : null

  const autoSection = sections.find((section) => section.id === autoSectionId)
  const autoBlueprint = useMemo(
    () => blueprintRowToModel((blueprintsQuery.data ?? []).find((row) => row.id === autoBlueprintId) ?? {
      code: null,
      test_year: null,
      version: null,
      official_facts_label: null,
      altitutor_policy_label: null,
      sections: null,
    }),
    [autoBlueprintId, blueprintsQuery.data],
  )
  const blueprintSourceOptions = useMemo(() =>
    (blueprintsQuery.data ?? []).flatMap((blueprint) =>
      blueprint.id && blueprint.code && blueprint.test_year != null && blueprint.version != null
        ? [{ value: blueprint.id, label: `${blueprint.test_year} v${blueprint.version} · ${blueprint.code}` }]
        : [],
    ), [blueprintsQuery.data])
  const autoSectionCategories = useMemo(
    () =>
      ((categoriesQuery.data ?? []) as AutoCategoryRow[])
        .filter((category) => category.id && category.ucat_section_id === autoSectionId)
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [autoSectionId, categoriesQuery.data],
  )
  const autoNamedCategories = useMemo(
    () =>
      autoSectionCategories
        .filter((category): category is AutoCategoryRow & { id: string; name: string } =>
          Boolean(category.id && category.name),
        )
        .map((category) => ({ id: category.id, name: category.name })),
    [autoSectionCategories],
  )
  const autoEligibleStems = useMemo(() => {
    if (!autoSectionId) return []
    return stemCatalog.filter((stem) => {
      if (stem.sectionId !== autoSectionId) return false
      if (!stem.categoryId) return false
      if (stem.questionsCount <= 0) return false
      if (autoStemVisibility === 'public' && stem.accessScope === 'private') return false
      if (autoStemVisibility === 'private' && stem.accessScope !== 'private') return false
      if (autoOnlyNotInAnotherSet && stem.setIds.length > 0) return false
      return true
    })
  }, [autoOnlyNotInAnotherSet, autoSectionId, autoStemVisibility, stemCatalog])

  const autoBlueprintPreferredTargets = useMemo(() => {
    if (!autoBlueprint || autoMode !== 'category' || !autoSectionId) return {}
    return blueprintPreferredCategoryTargets({
      blueprint: autoBlueprint,
      sectionNumber: autoSection?.section_number,
      categories: autoNamedCategories,
      eligibleStems: autoEligibleStems,
    })
  }, [
    autoBlueprint,
    autoEligibleStems,
    autoMode,
    autoNamedCategories,
    autoSection?.section_number,
    autoSectionId,
  ])

  const autoBlueprintRanges = useMemo(() => {
    if (!autoBlueprint || autoMode !== 'range' || !autoSectionId) return {}
    return blueprintCategoryRanges({
      blueprint: autoBlueprint,
      sectionNumber: autoSection?.section_number,
      categories: autoNamedCategories,
      eligibleStems: autoEligibleStems,
    })
  }, [
    autoBlueprint,
    autoEligibleStems,
    autoMode,
    autoNamedCategories,
    autoSection?.section_number,
    autoSectionId,
  ])

  function applyBlueprintSource(blueprintId: string | null, mode: AutoSetMode = autoMode) {
    setAutoBlueprintId(blueprintId)
    const blueprint = blueprintRowToModel((blueprintsQuery.data ?? []).find((row) => row.id === blueprintId) ?? {
      code: null,
      test_year: null,
      version: null,
      official_facts_label: null,
      altitutor_policy_label: null,
      sections: null,
    })
    if (!blueprint) {
      setAutoSeed((prev) => prev + 1)
      return
    }
    if (mode === 'category') {
      const preferred = blueprintPreferredCategoryTargets({
        blueprint,
        sectionNumber: autoSection?.section_number,
        categories: autoNamedCategories,
        eligibleStems: autoEligibleStems,
      })
      setAutoCategoryTargets(preferred)
    } else if (mode === 'range') {
      const ranges = blueprintCategoryRanges({
        blueprint,
        sectionNumber: autoSection?.section_number,
        categories: autoNamedCategories,
        eligibleStems: autoEligibleStems,
      })
      const sectionCode = blueprintSectionCode(autoSection?.section_number)
      const officialTotal = sectionCode
        ? (blueprint.official.sections.find((section) => section.section === sectionCode)?.questionCount ?? 0)
        : 0
      setAutoTargetTotal(officialTotal > 0 ? String(officialTotal) : '')
      setAutoCategoryRanges(
        Object.fromEntries(
          Object.entries(ranges).map(([id, range]) => [id, { min: range.min, max: range.max }]),
        ),
      )
    }
    setAutoSeed((prev) => prev + 1)
  }

  const autoTargetQuestions = autoMode === 'total'
    ? positiveIntFromInput(autoTargetTotal)
    : autoMode === 'category'
      ? Object.values(autoCategoryTargets).reduce((sum, value) => sum + positiveIntFromInput(value), 0)
      : positiveIntFromInput(autoTargetTotal)

  const autoRangeValidationError = useMemo(() => {
    if (autoMode !== 'range' || autoTargetQuestions <= 0) return null
    const optedIn = autoSectionCategories.flatMap((category) => {
      const id = category.id ?? ''
      const parsed = parseCategoryRange(autoCategoryRanges[id])
      if (!parsed) return []
      return [{ name: category.name ?? 'Untitled category', ...parsed }]
    })
    if (optedIn.length === 0) {
      return autoBlueprint != null && Object.keys(autoBlueprintRanges).length === 0
        ? null
        : 'Enter min and max for at least one category.'
    }
    for (const row of optedIn) {
      if (row.max < row.min) {
        return `${row.name}: max is less than min.`
      }
    }
    const sumMin = optedIn.reduce((sum, row) => sum + row.min, 0)
    const sumMax = optedIn.reduce((sum, row) => sum + row.max, 0)
    if (sumMin > autoTargetQuestions) {
      return `Sum of minimums (${sumMin}) exceeds the global total (${autoTargetQuestions}).`
    }
    if (sumMax < autoTargetQuestions) {
      return `Sum of maximums (${sumMax}) is below the global total (${autoTargetQuestions}).`
    }
    return null
  }, [
    autoBlueprintRanges,
    autoBlueprint,
    autoCategoryRanges,
    autoMode,
    autoSectionCategories,
    autoTargetQuestions,
  ])

  const autoCriteriaReady = !autoCriteriaEnabled
    || (!!autoSectionId && autoTargetQuestions > 0 && !autoRangeValidationError)

  useEffect(() => {
    if (!open || autoBlueprintId || blueprintSourceOptions.length === 0) return
    applyBlueprintSource(blueprintSourceOptions[0].value)
    // Default only when opening with no explicit selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBlueprintId, blueprintSourceOptions, open])

  useEffect(() => {
    if (!open || !autoCriteriaEnabled || !autoBlueprintId || !autoBlueprint || !autoSectionId) return
    if (autoMode === 'total') return
    applyBlueprintSource(autoBlueprintId, autoMode)
    // Re-apply only when the source inputs change; applyBlueprintSource uses the latest snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBlueprint, autoBlueprintId, autoCriteriaEnabled, autoMode, autoNamedCategories, autoSectionId, open, stemCatalogLoading])

  useEffect(() => {
    if (!open || !autoCriteriaEnabled) {
      setAutoPreview(null)
      setAutoPreviewLoading(false)
      return
    }
    if (!autoSectionId || autoTargetQuestions <= 0 || stemCatalogLoading || autoRangeValidationError) {
      setAutoPreview(null)
      setAutoPreviewLoading(false)
      return
    }
    if (stemCatalogError) {
      setAutoPreview(null)
      setAutoPreviewLoading(false)
      return
    }

    let cancelled = false
    setAutoPreviewLoading(true)
    void buildAutoSetPreviewAsync({
      mode: autoMode,
      blueprint: autoBlueprint,
      targetTotal: positiveIntFromInput(autoTargetTotal),
      categoryTargets: autoCategoryTargets,
      categoryRanges: autoCategoryRanges,
      sectionId: autoSectionId,
      sectionNumber: autoSection?.section_number,
      stemVisibility: autoStemVisibility,
      onlyNotInAnotherSet: autoOnlyNotInAnotherSet,
      categories: (categoriesQuery.data ?? []) as AutoCategoryRow[],
      stems: stemCatalog,
      existingStemIds: variant === 'fill' ? existingStemIds : undefined,
      seed: autoSeed,
    }).then((preview) => {
      if (!cancelled) {
        setAutoPreview(preview)
        setAutoPreviewLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setAutoPreview(null)
        setAutoPreviewLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    autoBlueprint,
    autoCategoryRanges,
    autoCategoryTargets,
    autoCriteriaEnabled,
    autoMode,
    autoOnlyNotInAnotherSet,
    autoRangeValidationError,
    autoSection?.section_number,
    autoSectionId,
    autoSeed,
    autoStemVisibility,
    autoTargetQuestions,
    autoTargetTotal,
    categoriesQuery.data,
    existingStemIds,
    open,
    stemCatalog,
    stemCatalogError,
    stemCatalogLoading,
    variant,
  ])

  const autoPrivateStemCount =
    autoPreview?.selectedStems.filter((stem) => stem.accessScope === 'private').length ?? 0
  const autoCreateDisabled =
    autoCriteriaEnabled &&
    (!autoCriteriaReady ||
      stemCatalogLoading ||
      autoPreviewLoading ||
      !!autoRangeValidationError ||
      !autoPreview ||
      autoPreview.selectedStems.length === 0 ||
      autoPreview.totalQuestions <= 0 ||
      (variant === 'fill' && autoPreview.selectedStems.every((stem) => existingStemIds.includes(stem.id))))

  const createQuestionCount = autoCriteriaEnabled ? (autoPreview?.totalQuestions ?? 0) : 0
  const resolvedTimeLimitSeconds = resolveSetTimeLimitSeconds({
    source: timeLimitSource,
    timePerQuestion: autoSection?.time_per_question,
    questionCount: createQuestionCount,
    speed: timeLimitSpeed,
    customMinutes: timeLimitMinutes,
    customSeconds: timeLimitSeconds,
  })
  const timeLimitInvalid =
    timeLimitSource === 'custom' && !isSetTimeLimitValid(timeLimitSource, resolvedTimeLimitSeconds)

  function handleClose() {
    onClose()
  }

  async function onCreate() {
    if (!autoSectionId || !autoBlueprintId) return
    if (variant === 'fill') {
      if (!autoPreview) return
      onFilled?.(autoPreview.selectedStems.map((stem) => stem.id))
      onClose()
      return
    }
    const stemIds = autoCriteriaEnabled ? (autoPreview?.selectedStems.map((stem) => stem.id) ?? []) : []
    const payload: UcatQuestionSetPayload = {
      authoringNote,
      description,
      timingMode: timeLimitSource === 'paced' ? 'pace' : timeLimitSource === 'custom' ? 'fixed' : 'untimed',
      paceMultiplier: timeLimitSource === 'paced' ? timeLimitSpeed : null,
      fixedTimeLimitSeconds: timeLimitSource === 'custom' ? resolvedTimeLimitSeconds : null,
      setFormat,
      accessScope: isPrivate ? 'private' : 'public',
      sectionId: autoSectionId,
      referenceBlueprintId: autoBlueprintId,
      stemIds,
    }
    try {
      const result = await createSet.mutateAsync(payload)
      const setName = `${autoSection?.name ?? 'UCAT'} ${setFormat === 'full_section' ? 'Full' : 'Partial'} Set`
      onClose()
      onCreated(result.id, setName)
    } catch (error) {
      toast(lifecycleErrorToast(error, 'Cannot create set', router.push, onOpenLifecycleEntity))
    }
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={handleClose}
      title={variant === 'fill' ? 'Auto-fill Set' : 'Create Set'}
      subtitle={variant === 'fill' ? 'Preserve current questions and fill the remaining target' : 'Create a new UCAT set'}
      onSave={() => void onCreate()}
      saveLabel={variant === 'fill' ? 'Add questions' : 'Create'}
      saveDisabled={
        (variant === 'create' && createSet.isPending) ||
        !autoSectionId ||
        !autoBlueprintId ||
        autoCreateDisabled ||
        (variant === 'create' && timeLimitInvalid)
      }
      isSaving={variant === 'create' && createSet.isPending}
    >
      <div className={cn('flex h-full min-h-0 flex-col md:flex-row')}>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className={tutorCardCn('space-y-1 px-3 py-2')}>
            {variant === 'create' ? (
              <>
            <UcatSetPropertyRow label="Tutor note">
              <Input
                value={authoringNote}
                onChange={(event) => setAuthoringNote(event.target.value)}
                placeholder="Optional internal note"
              />
            </UcatSetPropertyRow>
            <UcatSetPropertyRow label="Section">
              <SearchableSelect<(typeof sections)[number]>
                items={sections}
                value={sections.find((section) => (section.id ?? '') === (autoSectionId ?? '')) ?? null}
                onValueChange={(section) => {
                  setAutoSectionId(section?.id ?? null)
                  setAutoCategoryTargets({})
                  setAutoCategoryRanges({})
                  setAutoSeed((prev) => prev + 1)
                }}
                getItemLabel={(section) => section.name ?? 'Untitled'}
                getItemId={(section) => section.id ?? ''}
                placeholder="Select section"
              />
            </UcatSetPropertyRow>
            <UcatSetPropertyRow label="Format">
              <SearchableSelect<(typeof SET_FORMAT_OPTIONS)[number]>
                items={SET_FORMAT_OPTIONS}
                value={SET_FORMAT_OPTIONS.find((item) => item.value === setFormat) ?? null}
                onValueChange={(item) => item && setSetFormat(item.value)}
                getItemLabel={(item) => item.label}
                getItemId={(item) => item.value}
              />
            </UcatSetPropertyRow>
            <UcatSetPropertyRow label="Reference blueprint">
              <SearchableSelect<(typeof blueprintSourceOptions)[number]>
                items={blueprintSourceOptions}
                value={blueprintSourceOptions.find((item) => item.value === autoBlueprintId) ?? null}
                onValueChange={(item) => item && applyBlueprintSource(item.value)}
                getItemLabel={(item) => item.label}
                getItemId={(item) => item.value}
                placeholder="Select blueprint"
              />
            </UcatSetPropertyRow>
            <UcatSetPropertyRow label="Description">
              <Textarea
                className="min-h-20"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </UcatSetPropertyRow>
            <UcatSetPropertyRow label="Time limit">
              <UcatSetTimeLimitFields
                source={timeLimitSource}
                speed={timeLimitSpeed}
                minutes={timeLimitMinutes}
                seconds={timeLimitSeconds}
                questionCount={createQuestionCount}
                timePerQuestion={autoSection?.time_per_question}
                onChangeSource={setTimeLimitSource}
                onChangeSpeed={setTimeLimitSpeed}
                onChangeMinutes={setTimeLimitMinutes}
                onChangeSeconds={setTimeLimitSeconds}
              />
            </UcatSetPropertyRow>
            <UcatSetPropertyRow label={<UcatVisibilityFieldLabel />}>
              <SearchableSelect<{ value: 'public' | 'private'; label: string }>
                items={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                ]}
                value={isPrivate ? { value: 'private', label: 'Private' } : { value: 'public', label: 'Public' }}
                onValueChange={(item) => setIsPrivate(item?.value === 'private')}
                getItemLabel={(item) => item.label}
                getItemId={(item) => item.value}
              />
            </UcatSetPropertyRow>
              </>
            ) : (
              <div className="px-1 py-2 text-sm text-muted-foreground">
                {existingStemIds.length} existing {existingStemIds.length === 1 ? 'stem is' : 'stems are'} preserved.
                The preview adds only what is needed to best match the selected targets.
              </div>
            )}
            {variant === 'create' ? (
              <UcatSetPropertyRow label="Automatically add questions based on criteria">
              <div className="space-y-1">
                <div className="flex h-10 items-center">
                  <Switch
                    checked={autoCriteriaEnabled}
                    onCheckedChange={(checked) => {
                      setAutoCriteriaEnabled(checked)
                      setAutoSeed((prev) => prev + 1)
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Selects whole approved stems. Exact question totals may not be possible.
                </p>
              </div>
              </UcatSetPropertyRow>
            ) : null}

            {autoCriteriaEnabled ? (
              <>
                {autoSectionId ? (
                  <>
                    <UcatSetPropertyRow label="Question targets">
                      <SearchableSelect<(typeof AUTO_MODE_OPTIONS)[number]>
                        items={AUTO_MODE_OPTIONS}
                        value={AUTO_MODE_OPTIONS.find((item) => item.value === autoMode) ?? null}
                        onValueChange={(item) => {
                          if (!item) return
                          setAutoMode(item.value)
                          if (item.value !== 'total' && autoBlueprintId) {
                            applyBlueprintSource(autoBlueprintId, item.value)
                            return
                          }
                          setAutoSeed((prev) => prev + 1)
                        }}
                        getItemLabel={(item) => item.label}
                        getItemId={(item) => item.value}
                      />
                    </UcatSetPropertyRow>

                    {autoMode === 'total' || autoMode === 'range' ? (
                      <UcatSetPropertyRow label="Total questions">
                        <Input
                          type="number"
                          min={1}
                          value={autoTargetTotal}
                          onChange={(event) => {
                            setAutoTargetTotal(event.target.value)
                            setAutoSeed((prev) => prev + 1)
                          }}
                          placeholder="e.g. 20"
                        />
                      </UcatSetPropertyRow>
                    ) : null}

                    {autoMode === 'category' ? (
                      <div className="space-y-2 py-1.5">
                        <div className="text-sm text-muted-foreground">Questions by category</div>
                        {autoBlueprint ? (
                          <p className="text-xs text-muted-foreground">
                            Prefills preferred counts from {autoBlueprint.testYear} v{autoBlueprint.version}
                            {Object.keys(autoBlueprintPreferredTargets).length === 0
                              ? ' (this section uses the official question total only).'
                              : '; values stay editable.'}
                          </p>
                        ) : null}
                        {autoSectionCategories.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No categories are configured for this section.</p>
                        ) : autoBlueprint && Object.keys(autoBlueprintPreferredTargets).length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Official target: {autoTargetQuestions} questions.
                          </p>
                        ) : (
                          autoSectionCategories.map((category) => {
                            const id = category.id ?? ''
                            const previewRow = autoPreview?.byCategory.find((row) => row.categoryId === id)
                            const targetValue = autoCategoryTargets[id] ?? ''
                            const eligibleCount =
                              previewRow?.eligibleStemCount ??
                              autoEligibleStems.filter((stem) => stem.categoryId === id).length
                            return (
                              <UcatSetPropertyRow key={id} label={category.name ?? 'Untitled category'}>
                                <div className="space-y-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={targetValue}
                                    onChange={(event) => {
                                      setAutoCategoryTargets((prev) => ({
                                        ...prev,
                                        [id]: event.target.value,
                                      }))
                                      setAutoSeed((prev) => prev + 1)
                                    }}
                                    placeholder="0"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    {eligibleCount} eligible {eligibleCount === 1 ? 'stem' : 'stems'}
                                  </p>
                                </div>
                              </UcatSetPropertyRow>
                            )
                          })
                        )}
                      </div>
                    ) : null}

                    {autoMode === 'range' ? (
                      <div className="space-y-2 py-1.5">
                        <div className="text-sm text-muted-foreground">Category ranges</div>
                        <p className="text-xs text-muted-foreground">
                          Enter both min and max to include a category. Categories can trade off as long as the
                          global total is hit.
                        </p>
                        {autoBlueprint ? (
                          <p className="text-xs text-muted-foreground">
                            Prefills official total and policy min/max from {autoBlueprint.testYear} v{autoBlueprint.version}
                            {Object.keys(autoBlueprintRanges).length === 0
                              ? ' (this section has no category bands; total only).'
                              : '; values stay editable.'}
                          </p>
                        ) : null}
                        {autoSectionCategories.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No categories are configured for this section.</p>
                        ) : autoBlueprint && Object.keys(autoBlueprintRanges).length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Official target: {autoTargetQuestions} questions.
                          </p>
                        ) : (
                          autoSectionCategories.map((category) => {
                            const id = category.id ?? ''
                            const previewRow = autoPreview?.byCategory.find((row) => row.categoryId === id)
                            const rangeValue = autoCategoryRanges[id] ?? { min: '', max: '' }
                            const eligibleCount =
                              previewRow?.eligibleStemCount ??
                              autoEligibleStems.filter((stem) => stem.categoryId === id).length
                            return (
                              <UcatSetPropertyRow key={id} label={category.name ?? 'Untitled category'}>
                                <div className="space-y-1">
                                  <div className="grid grid-cols-2 gap-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={rangeValue.min}
                                      onChange={(event) => {
                                        setAutoCategoryRanges((prev) => ({
                                          ...prev,
                                          [id]: { min: event.target.value, max: prev[id]?.max ?? '' },
                                        }))
                                        setAutoSeed((prev) => prev + 1)
                                      }}
                                      placeholder="min"
                                      aria-label={`${category.name ?? 'Category'} minimum`}
                                    />
                                    <Input
                                      type="number"
                                      min={0}
                                      value={rangeValue.max}
                                      onChange={(event) => {
                                        setAutoCategoryRanges((prev) => ({
                                          ...prev,
                                          [id]: { min: prev[id]?.min ?? '', max: event.target.value },
                                        }))
                                        setAutoSeed((prev) => prev + 1)
                                      }}
                                      placeholder="max"
                                      aria-label={`${category.name ?? 'Category'} maximum`}
                                    />
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {eligibleCount} eligible {eligibleCount === 1 ? 'stem' : 'stems'}
                                  </p>
                                </div>
                              </UcatSetPropertyRow>
                            )
                          })
                        )}
                        {autoRangeValidationError ? (
                          <p className="text-xs text-amber-700 dark:text-amber-400">{autoRangeValidationError}</p>
                        ) : null}
                      </div>
                    ) : null}

                    <UcatSetPropertyRow label="Stem visibility">
                      <SearchableSelect<(typeof STEM_VISIBILITY_OPTIONS)[number]>
                        items={STEM_VISIBILITY_OPTIONS}
                        value={STEM_VISIBILITY_OPTIONS.find((item) => item.value === autoStemVisibility) ?? null}
                        onValueChange={(item) => {
                          if (!item) return
                          setAutoStemVisibility(item.value)
                          setAutoSeed((prev) => prev + 1)
                        }}
                        getItemLabel={(item) => item.label}
                        getItemId={(item) => item.value}
                      />
                    </UcatSetPropertyRow>

                    <UcatSetPropertyRow label="Only include stems not already in another set">
                      <div className="space-y-1">
                        <div className="flex h-10 items-center">
                          <Switch
                            checked={autoOnlyNotInAnotherSet}
                            onCheckedChange={(checked) => {
                              setAutoOnlyNotInAnotherSet(checked)
                              setAutoSeed((prev) => prev + 1)
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Checks non-deleted staff-authored sets, including private sets.
                        </p>
                      </div>
                    </UcatSetPropertyRow>
                  </>
                ) : (
                  <p className="py-2 text-xs text-muted-foreground">Select a section to choose question criteria.</p>
                )}
              </>
            ) : null}
          </div>
        </div>

        {autoCriteriaEnabled ? (
          <div className="min-h-0 flex-1 overflow-y-auto border-t p-6 md:border-l md:border-t-0">
            <div className={tutorCardCn('space-y-3 p-4')}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Live preview</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setAutoSeed((prev) => prev + 1)}>
                  Refresh
                </Button>
              </div>
              {stemCatalogLoading ? (
                <p className="text-xs text-muted-foreground">Loading eligible stems...</p>
              ) : stemCatalogError ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">{stemCatalogError}</p>
              ) : !autoSectionId ? (
                <p className="text-xs text-muted-foreground">Select a section to preview stems.</p>
              ) : autoTargetQuestions <= 0 ? (
                <p className="text-xs text-muted-foreground">Enter a positive question target to preview stems.</p>
              ) : autoRangeValidationError ? (
                <p className="text-xs text-muted-foreground">Fix the range validation error to preview stems.</p>
              ) : autoPreviewLoading ? (
                <p className="text-xs text-muted-foreground">
                  {autoBlueprint ? `Building ${autoBlueprint.testYear} v${autoBlueprint.version} blueprint preview...` : 'Building preview...'}
                </p>
              ) : autoPreview ? (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{autoPreview.selectedStems.length} stems</Badge>
                    <Badge variant="secondary">
                      {autoPreview.totalQuestions} / {autoPreview.targetQuestions} questions
                    </Badge>
                  </div>
                  {(autoMode === 'category' || autoMode === 'range') && autoPreview.byCategory.length > 0 ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {autoPreview.byCategory.map((row) => (
                        <div key={row.categoryId} className="flex justify-between gap-3">
                          <span className="truncate">{row.categoryName}</span>
                          <span className="shrink-0">
                            {autoMode === 'range' && row.minQuestions != null && row.maxQuestions != null
                              ? `${row.actualQuestions} in ${row.minQuestions}–${row.maxQuestions}`
                              : `${row.actualQuestions} / ${row.targetQuestions} questions`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {autoBlueprint && autoPreview.blueprintCompliance ? (
                    <UcatBlueprintCompliancePanel compliance={autoPreview.blueprintCompliance} />
                  ) : null}
                  {autoPreview.selectedStems.length > 0 ? (
                    <div className="max-h-80 space-y-1 overflow-y-auto border-t pt-2 text-xs">
                      {autoPreview.selectedStems.map((stem, index) => (
                        <div key={stem.id} className="flex gap-2">
                          <span className="w-5 shrink-0 text-muted-foreground">{index + 1}.</span>
                          <span className="min-w-0 flex-1 truncate">{stem.text || 'Untitled stem'}</span>
                          <span className="shrink-0 text-muted-foreground">{stem.questionsCount} q</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!isPrivate && autoPrivateStemCount > 0 ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {autoPrivateStemCount} private {autoPrivateStemCount === 1 ? 'stem' : 'stems'} will be available through this public set.
                    </p>
                  ) : null}
                  {autoPreview.warnings.map((warning) => (
                    <p key={warning} className="text-xs text-amber-700 dark:text-amber-400">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </UcatDialogShell>
  )
}
