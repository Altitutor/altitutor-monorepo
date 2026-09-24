'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import {
  Button,
  Input,
  ListToolbar,
  SearchableSelect,
  Switch,
  Textarea,
} from '@altitutor/ui'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useUcatMockBlueprints } from '@/features/ucat/mocks/hooks/useUcatMocks'
import { UcatSetTimeLimitFields } from '@/features/ucat/sets/components/UcatSetTimeLimitFields'
import {
  PACED_SPEED_DEFAULT,
  resolveSetTimeLimitSeconds,
  type SetTimeLimitSource,
} from '@/features/ucat/sets/lib/set-time-limit'
import type { UcatQuestionSetFormat } from '@/features/ucat/shared/types'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { formatSecondsToDuration } from '@/features/ucat/shared/lib/time-utils'
import {
  applyBooleanTextFilter,
  applyCoreStringFilter,
  applyRangeFilter,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { Pencil } from 'lucide-react'
import {
  SegmentedTabPanel,
  SegmentedTabPanelContent,
} from '@/shared/components/segmented-tab-panel'
import { tutorToolbarProps } from '@/shared/lib/tutor-visual'

type SetOption = {
  id: string
  name: string
  sectionDisplay: string
  question_count: number | null
  time_limit_seconds: number | null
  access_scope?: 'public' | 'private' | null
  stem_count?: number | null
}

function formatSectionsDisplay(sections: unknown): string {
  if (!Array.isArray(sections)) return ''
  return sections
    .map((s: { section_number?: number; name?: string }) => {
      if (s?.section_number != null && s?.name != null) return `Section ${s.section_number}: ${s.name}`
      if (s?.name) return String(s.name)
      return ''
    })
    .filter(Boolean)
    .join(' · ')
}

export type AddToSetConfig =
  | { mode: 'existing'; setId: string }
  | {
      mode: 'create'
      authoringNote: string
      description: string
      timingMode: 'pace' | 'fixed' | 'untimed'
      paceMultiplier: number | null
      fixedTimeLimitSeconds: number | null
      setFormat: UcatQuestionSetFormat
      referenceBlueprintId: string
      isPrivate: boolean
    }

type Step4CreateSetProps = {
  sectionId: string
  questionCount: number
  addToSetEnabled: boolean
  onAddToSetEnabledChange: (value: boolean) => void
  addToSetConfig: AddToSetConfig | null
  onAddToSetConfigChange: (config: AddToSetConfig | null) => void
  onEditSet?: (setId: string) => void
}

const SET_FILTER_DEFINITIONS: DataTableFilterDefinition[] = [
  {
    key: 'visibility',
    label: 'Visibility',
    options: [
      { label: 'Public', value: 'public' },
      { label: 'Private', value: 'private' },
    ],
  },
  {
    key: 'time_limit',
    label: 'Time limit (s)',
    type: 'number-range',
    minKey: 'time_limit_min',
    maxKey: 'time_limit_max',
    nullOptionLabel: 'Untimed',
  },
  {
    key: 'stem_count',
    label: 'Question stems',
    type: 'number-range',
    minKey: 'stem_count_min',
    maxKey: 'stem_count_max',
  },
  {
    key: 'question_count',
    label: 'Questions',
    type: 'number-range',
    minKey: 'question_count_min',
    maxKey: 'question_count_max',
  },
]

export function Step4CreateSet({
  sectionId,
  questionCount,
  addToSetEnabled,
  onAddToSetEnabledChange,
  addToSetConfig,
  onAddToSetConfigChange,
  onEditSet,
}: Step4CreateSetProps) {
  const setsQuery = useUcatSets()
  const sectionsQuery = useUcatSections()
  const blueprintsQuery = useUcatMockBlueprints()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const [createNewSet, setCreateNewSet] = useState(false)
  const [createAuthoringNote, setCreateAuthoringNote] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createTimeLimitSource, setCreateTimeLimitSource] = useState<SetTimeLimitSource>('paced')
  const [createPaceMultiplier, setCreatePaceMultiplier] = useState(PACED_SPEED_DEFAULT)
  const [createTimeLimitMinutes, setCreateTimeLimitMinutes] = useState('')
  const [createTimeLimitSeconds, setCreateTimeLimitSeconds] = useState('')
  const [createSetFormat, setCreateSetFormat] = useState<UcatQuestionSetFormat>('partial_section')
  const [createReferenceBlueprintId, setCreateReferenceBlueprintId] = useState('')
  const [createIsPrivate, setCreateIsPrivate] = useState(false)

  const section = (sectionsQuery.data ?? []).find((candidate) => candidate.id === sectionId)
  const blueprintOptions = useMemo(
    () => (blueprintsQuery.data ?? []).flatMap((blueprint) => {
      if (!blueprint.id) return []
      return [{
        id: blueprint.id,
        label: `${blueprint.code ?? 'Blueprint'} (${blueprint.test_year ?? '—'} v${blueprint.version ?? '—'})`,
        sections: blueprint.sections,
      }]
    }),
    [blueprintsQuery.data],
  )
  const blueprintSection = useMemo(() => {
    const selected = blueprintOptions.find((blueprint) => blueprint.id === createReferenceBlueprintId)
    if (!selected || !Array.isArray(selected.sections) || section?.section_number == null) return null
    return selected.sections.find((candidate) => {
      if (!candidate || typeof candidate !== 'object') return false
      return (candidate as { sectionIndex?: unknown }).sectionIndex === section.section_number! - 1
    }) as { answeringTimeSeconds?: number; exactQuestionCount?: number } | null
  }, [blueprintOptions, createReferenceBlueprintId, section?.section_number])
  const timePerQuestion =
    blueprintSection?.answeringTimeSeconds != null
    && blueprintSection.exactQuestionCount != null
    && blueprintSection.exactQuestionCount > 0
      ? blueprintSection.answeringTimeSeconds / blueprintSection.exactQuestionCount
      : null

  const setCatalog = useMemo<SetOption[]>(() => {
    return (setsQuery.data ?? [])
        .filter((set) => (set as { deleted_at?: string | null }).deleted_at == null)
        .filter((set) => !sectionId || set.section_id === sectionId)
      .map((set) => ({
        id: set.id ?? '',
        name: proseMirrorToPlainText(set.name ?? null) || 'Untitled',
        sectionDisplay: set.section_name
          ? (set.section_number != null ? `Section ${set.section_number}: ${set.section_name}` : set.section_name)
          : formatSectionsDisplay(set.sections ?? null),
        question_count: set.question_count ?? null,
        time_limit_seconds: set.time_limit_seconds ?? null,
        access_scope: (set as { access_scope?: 'public' | 'private' | null }).access_scope ?? null,
        stem_count: (set as { stem_count?: number | null }).stem_count ?? null,
      }))
  }, [sectionId, setsQuery.data])

  const setsTableState = useMemo(
    () => ({
      search,
      filters,
      sortBy: null,
      sortDirection: 'desc' as const,
      groupBy: null,
      page: 1,
      pageSize: 100,
      visibleColumns: [] as string[],
    }),
    [search, filters]
  )

  const filteredSets = useMemo(() => {
    return setCatalog.filter((set) => {
      const searchHit =
        !search.trim() ||
        applyCoreStringFilter(set.name, search) ||
        applyCoreStringFilter(set.sectionDisplay, search)
      const visibilityHit = applyBooleanTextFilter(
        setsTableState,
        'visibility',
        set.access_scope === 'private',
      )
      const timeLimitHit = applyRangeFilter(
        setsTableState,
        'time_limit_min',
        'time_limit_max',
        set.time_limit_seconds ?? null,
        {
          nullFilterKey: 'time_limit',
          treatNonPositiveAsNull: true,
        }
      )
      const stemCountHit = applyRangeFilter(
        setsTableState,
        'stem_count_min',
        'stem_count_max',
        set.stem_count ?? null
      )
      const questionCountHit = applyRangeFilter(
        setsTableState,
        'question_count_min',
        'question_count_max',
        set.question_count ?? null
      )
      return searchHit && visibilityHit && timeLimitHit && stemCountHit && questionCountHit
    })
  }, [search, setCatalog, setsTableState])

  function handleSelectSet(setId: string) {
    onAddToSetConfigChange({ mode: 'existing', setId })
  }

  function handleCreateNewSetToggle(enabled: boolean) {
    setCreateNewSet(enabled)
    if (enabled) {
      setCreateAuthoringNote('')
      setCreateDescription('')
      setCreateTimeLimitSource('paced')
      setCreatePaceMultiplier(PACED_SPEED_DEFAULT)
      setCreateTimeLimitMinutes('')
      setCreateTimeLimitSeconds('')
      setCreateSetFormat('partial_section')
      setCreateIsPrivate(false)
      onAddToSetConfigChange({
        mode: 'create',
        authoringNote: '',
        description: '',
        timingMode: 'pace',
        paceMultiplier: PACED_SPEED_DEFAULT,
        fixedTimeLimitSeconds: null,
        setFormat: 'partial_section',
        referenceBlueprintId: createReferenceBlueprintId,
        isPrivate: false,
      })
    } else {
      onAddToSetConfigChange(null)
    }
  }

  function buildCreateConfig(overrides: {
    authoringNote?: string
    description?: string
    timeLimitSource?: SetTimeLimitSource
    paceMultiplier?: number
    timeLimitMinutes?: string
    timeLimitSeconds?: string
    setFormat?: UcatQuestionSetFormat
    referenceBlueprintId?: string
    isPrivate?: boolean
  } = {}): AddToSetConfig {
    const authoringNote = overrides.authoringNote ?? createAuthoringNote
    const description = overrides.description ?? createDescription
    const timeLimitSource = overrides.timeLimitSource ?? createTimeLimitSource
    const paceMultiplier = overrides.paceMultiplier ?? createPaceMultiplier
    const mins = overrides.timeLimitMinutes ?? createTimeLimitMinutes
    const secs = overrides.timeLimitSeconds ?? createTimeLimitSeconds
    const setFormat = overrides.setFormat ?? createSetFormat
    const referenceBlueprintId = overrides.referenceBlueprintId ?? createReferenceBlueprintId
    const isPrivate = overrides.isPrivate ?? createIsPrivate
    const fixedTimeLimitSeconds = resolveSetTimeLimitSeconds({
      source: timeLimitSource,
      timePerQuestion,
      questionCount,
      speed: paceMultiplier,
      customMinutes: mins,
      customSeconds: secs,
    })
    return {
      mode: 'create',
      authoringNote: authoringNote.trim(),
      description: description.trim(),
      timingMode: timeLimitSource === 'custom' ? 'fixed' : timeLimitSource === 'paced' ? 'pace' : 'untimed',
      paceMultiplier: timeLimitSource === 'paced' ? paceMultiplier : null,
      fixedTimeLimitSeconds: timeLimitSource === 'custom' ? fixedTimeLimitSeconds : null,
      setFormat,
      referenceBlueprintId,
      isPrivate,
    }
  }

  useEffect(() => {
    if (!createNewSet || createReferenceBlueprintId || blueprintOptions.length === 0) return
    const referenceBlueprintId = blueprintOptions[0].id
    setCreateReferenceBlueprintId(referenceBlueprintId)
    onAddToSetConfigChange(buildCreateConfig({ referenceBlueprintId }))
    // Initialise the visible blueprint selection when the catalog arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprintOptions, createNewSet, createReferenceBlueprintId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="add-to-set-toggle" className="text-sm font-medium">
          Add the imported questions to a set?
        </label>
        <Switch
          id="add-to-set-toggle"
          checked={addToSetEnabled}
          onCheckedChange={(checked) => {
            onAddToSetEnabledChange(checked)
            if (!checked) {
              setCreateNewSet(false)
              onAddToSetConfigChange(null)
            }
          }}
        />
      </div>

      {addToSetEnabled && (
        <SegmentedTabPanel
          value={createNewSet ? 'create' : 'existing'}
          onValueChange={(v) => handleCreateNewSetToggle(v === 'create')}
          selectorClassName="max-w-xs"
          options={[
            { value: 'existing', label: 'Select existing set' },
            { value: 'create', label: 'Create new set' },
          ]}
        >
          <SegmentedTabPanelContent when="create" activeTab={createNewSet ? 'create' : 'existing'} className="mt-4 space-y-4">
              <h3 className="font-medium">New set details</h3>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Tutor note</span>
                <Input
                  value={createAuthoringNote}
                  onChange={(e) => {
                    const v = e.target.value
                    setCreateAuthoringNote(v)
                    onAddToSetConfigChange(buildCreateConfig({ authoringNote: v }))
                  }}
                  placeholder="Optional internal note"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Format</span>
                <SearchableSelect<{ value: UcatQuestionSetFormat; label: string }>
                  items={[
                    { value: 'partial_section', label: 'Partial section' },
                    { value: 'full_section', label: 'Full section' },
                  ]}
                  value={createSetFormat === 'full_section'
                    ? { value: 'full_section', label: 'Full section' }
                    : { value: 'partial_section', label: 'Partial section' }}
                  onValueChange={(item) => {
                    if (!item) return
                    setCreateSetFormat(item.value)
                    onAddToSetConfigChange(buildCreateConfig({ setFormat: item.value }))
                  }}
                  getItemLabel={(item) => item.label}
                  getItemId={(item) => item.value}
                  fullWidth
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Reference blueprint</span>
                <SearchableSelect<(typeof blueprintOptions)[number]>
                  items={blueprintOptions}
                  value={blueprintOptions.find((item) => item.id === createReferenceBlueprintId) ?? null}
                  onValueChange={(item) => {
                    const referenceBlueprintId = item?.id ?? ''
                    setCreateReferenceBlueprintId(referenceBlueprintId)
                    onAddToSetConfigChange(buildCreateConfig({ referenceBlueprintId }))
                  }}
                  getItemLabel={(item) => item.label}
                  getItemId={(item) => item.id}
                  placeholder="Select blueprint"
                  fullWidth
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Description</span>
                <Textarea
                  className="min-h-24"
                  value={createDescription}
                  onChange={(e) => {
                    const v = e.target.value
                    setCreateDescription(v)
                    onAddToSetConfigChange(buildCreateConfig({ description: v }))
                  }}
                  placeholder="Optional description"
                />
              </label>
              <div className="block text-sm">
                <span className="mb-1 block font-medium">Time limit</span>
                <UcatSetTimeLimitFields
                  source={createTimeLimitSource}
                  speed={createPaceMultiplier}
                  minutes={createTimeLimitMinutes}
                  seconds={createTimeLimitSeconds}
                  questionCount={questionCount}
                  timePerQuestion={timePerQuestion}
                  onChangeSource={(value) => {
                    setCreateTimeLimitSource(value)
                    onAddToSetConfigChange(buildCreateConfig({ timeLimitSource: value }))
                  }}
                  onChangeSpeed={(value) => {
                    setCreatePaceMultiplier(value)
                    onAddToSetConfigChange(buildCreateConfig({ paceMultiplier: value }))
                  }}
                  onChangeMinutes={(value) => {
                    setCreateTimeLimitMinutes(value)
                    onAddToSetConfigChange(buildCreateConfig({ timeLimitMinutes: value }))
                  }}
                  onChangeSeconds={(value) => {
                    setCreateTimeLimitSeconds(value)
                    onAddToSetConfigChange(buildCreateConfig({ timeLimitSeconds: value }))
                  }}
                />
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Visibility</span>
                <SearchableSelect<{ value: 'public' | 'private'; label: string }>
                  items={[
                    { value: 'public', label: 'Public' },
                    { value: 'private', label: 'Private' },
                  ]}
                  value={createIsPrivate ? { value: 'private', label: 'Private' } : { value: 'public', label: 'Public' }}
                  onValueChange={(item) => {
                    const priv = item?.value === 'private'
                    setCreateIsPrivate(priv)
                    onAddToSetConfigChange(buildCreateConfig({ isPrivate: priv }))
                  }}
                  getItemLabel={(i) => i.label}
                  getItemId={(i) => i.value}
                  fullWidth
                />
              </label>
          </SegmentedTabPanelContent>

          <SegmentedTabPanelContent when="existing" activeTab={createNewSet ? 'create' : 'existing'} className="mt-4 space-y-3">
              <ListToolbar
                search={search}
                onSearchChange={setSearch}
                {...tutorToolbarProps}
                searchPlaceholder="Filter sets"
                filterDefinitions={SET_FILTER_DEFINITIONS}
                filters={filters}
                onFiltersChange={setFilters}
              />
              <div className="max-h-80 space-y-1 overflow-auto">
                {filteredSets.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No sets match your search.
                  </p>
                ) : (
                  filteredSets.slice(0, 50).map((set) => (
                    <div
                      key={set.id}
                      className="flex w-full items-start justify-between gap-4 rounded border px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{set.name}</div>
                        {set.sectionDisplay ? (
                          <div className="text-xs text-muted-foreground">{set.sectionDisplay}</div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="grid grid-cols-2 gap-x-4 text-right text-sm text-muted-foreground">
                          <div>{set.question_count != null ? `${set.question_count} Q` : '—'}</div>
                          <div>{formatSecondsToDuration(set.time_limit_seconds)}</div>
                        </div>
                        {onEditSet && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => onEditSet(set.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant={addToSetConfig?.mode === 'existing' && addToSetConfig.setId === set.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleSelectSet(set.id)}
                        >
                          Select
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
          </SegmentedTabPanelContent>
        </SegmentedTabPanel>
      )}
    </div>
  )
}
