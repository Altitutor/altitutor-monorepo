'use client'

import { useMemo, useState } from 'react'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import {
  Button,
  Input,
  ListToolbar,
  SearchableSelect,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@altitutor/ui'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { formatSecondsToDuration, secondsToMinutesAndSeconds } from '@/features/ucat/shared/lib/time-utils'
import {
  applyBooleanTextFilter,
  applyCoreStringFilter,
  applyRangeFilter,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { Pencil } from 'lucide-react'

type SetOption = {
  id: string
  name: string
  sectionDisplay: string
  question_count: number | null
  time_limit_seconds: number | null
  is_private?: boolean | null
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
      name: string
      description: string
      isTimed: boolean
      timeLimitSeconds: number | null
      isPrivate: boolean
    }

type Step4CreateSetProps = {
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
  addToSetEnabled,
  onAddToSetEnabledChange,
  addToSetConfig,
  onAddToSetConfigChange,
  onEditSet,
}: Step4CreateSetProps) {
  const setsQuery = useUcatSets()
  const sectionsQuery = useUcatSections()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const [createNewSet, setCreateNewSet] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createIsTimed, setCreateIsTimed] = useState(true)
  const [createTimeLimitMinutes, setCreateTimeLimitMinutes] = useState('')
  const [createTimeLimitSeconds, setCreateTimeLimitSeconds] = useState('')
  const [createIsPrivate, setCreateIsPrivate] = useState(false)

  const setCatalog = useMemo<SetOption[]>(() => {
    return (setsQuery.data ?? [])
      .filter(
        (set) =>
          (set as { deleted_at?: string | null }).deleted_at == null &&
          !(set as { is_student_generated?: boolean }).is_student_generated
      )
      .map((set) => ({
        id: set.id ?? '',
        name: proseMirrorToPlainText(set.name ?? null) || 'Untitled',
        sectionDisplay: formatSectionsDisplay(set.sections ?? null),
        question_count: set.question_count ?? null,
        time_limit_seconds: set.time_limit_seconds ?? null,
        is_private: (set as { is_private?: boolean | null }).is_private ?? null,
        stem_count: (set as { stem_count?: number | null }).stem_count ?? null,
      }))
  }, [setsQuery.data])

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
      const visibilityHit = applyBooleanTextFilter(setsTableState, 'visibility', !!set.is_private)
      const timeLimitHit = applyRangeFilter(
        setsTableState,
        'time_limit_min',
        'time_limit_max',
        set.time_limit_seconds ?? null
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
      setCreateName('')
      setCreateDescription('')
      setCreateIsTimed(true)
      setCreateTimeLimitMinutes('')
      setCreateTimeLimitSeconds('')
      setCreateIsPrivate(false)
      onAddToSetConfigChange({
        mode: 'create',
        name: '',
        description: '',
        isTimed: true,
        timeLimitSeconds: null,
        isPrivate: false,
      })
    } else {
      onAddToSetConfigChange(null)
    }
  }

  function buildCreateConfig(overrides: {
    name?: string
    description?: string
    isTimed?: boolean
    timeLimitMinutes?: string
    timeLimitSeconds?: string
    isPrivate?: boolean
  } = {}): AddToSetConfig {
    const name = overrides.name ?? createName
    const description = overrides.description ?? createDescription
    const isTimed = overrides.isTimed ?? createIsTimed
    const mins = overrides.timeLimitMinutes ?? createTimeLimitMinutes
    const secs = overrides.timeLimitSeconds ?? createTimeLimitSeconds
    const isPrivate = overrides.isPrivate ?? createIsPrivate
    const totalSeconds =
      isTimed && (mins.trim() || secs.trim())
        ? (parseInt(mins, 10) || 0) * 60 + (parseInt(secs, 10) || 0)
        : null
    return {
      mode: 'create',
      name: name.trim(),
      description: description.trim(),
      isTimed,
      timeLimitSeconds: totalSeconds,
      isPrivate,
    }
  }

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
        <Tabs
          value={createNewSet ? 'create' : 'existing'}
          onValueChange={(v) => handleCreateNewSetToggle(v === 'create')}
        >
          <TabsList className="w-full max-w-xs">
            <TabsTrigger value="existing" className="flex-1">
              Select existing set
            </TabsTrigger>
            <TabsTrigger value="create" className="flex-1">
              Create new set
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-4 space-y-4">
              <h3 className="font-medium">New set details</h3>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Name</span>
                <Input
                  value={createName}
                  onChange={(e) => {
                    const v = e.target.value
                    setCreateName(v)
                    onAddToSetConfigChange(buildCreateConfig({ name: v }))
                  }}
                  placeholder="Set name"
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
              <label className="block text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">Time limit</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Untimed</span>
                    <Switch
                      checked={createIsTimed}
                      onCheckedChange={(v) => {
                        setCreateIsTimed(v)
                        if (!v) {
                          setCreateTimeLimitMinutes('')
                          setCreateTimeLimitSeconds('')
                          onAddToSetConfigChange(buildCreateConfig({ isTimed: false, timeLimitMinutes: '', timeLimitSeconds: '' }))
                        } else {
                          onAddToSetConfigChange(buildCreateConfig({ isTimed: true }))
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Timed</span>
                  </div>
                </div>
                {createIsTimed && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    className="w-20"
                    value={createTimeLimitMinutes}
                    onChange={(e) => {
                      const v = e.target.value
                      setCreateTimeLimitMinutes(v)
                      onAddToSetConfigChange(buildCreateConfig({ timeLimitMinutes: v }))
                    }}
                  />
                  <span className="text-muted-foreground font-medium">:</span>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    placeholder="0"
                    className="w-20"
                    value={createTimeLimitSeconds}
                    onChange={(e) => {
                      const v = e.target.value
                      setCreateTimeLimitSeconds(v)
                      onAddToSetConfigChange(buildCreateConfig({ timeLimitSeconds: v }))
                    }}
                  />
                  {(sectionsQuery.data ?? []).filter((s) => s.id != null && s.time_limit_seconds != null && s.time_limit_seconds > 0).length > 0 && (
                    <SearchableSelect<{ id: string; name: string }>
                      items={(sectionsQuery.data ?? [])
                        .filter((s): s is typeof s & { id: string; time_limit_seconds: number } =>
                          s.id != null && s.time_limit_seconds != null && s.time_limit_seconds > 0
                        )
                        .map((s) => ({ id: s.id!, name: `${s.name ?? 'Unknown'} (${formatSecondsToDuration(s.time_limit_seconds)})` }))}
                      value={null}
                      onValueChange={(sec) => {
                        if (!sec) return
                        const section = (sectionsQuery.data ?? []).find((s) => s.id === sec.id)
                        if (section?.time_limit_seconds != null) {
                          const { minutes, seconds } = secondsToMinutesAndSeconds(section.time_limit_seconds)
                          setCreateTimeLimitMinutes(minutes)
                          setCreateTimeLimitSeconds(seconds)
                          onAddToSetConfigChange(buildCreateConfig({ timeLimitMinutes: minutes, timeLimitSeconds: seconds }))
                        }
                      }}
                      getItemLabel={(s) => s.name}
                      getItemId={(s) => s.id}
                      placeholder="Use section time"
                      triggerClassName="w-[180px]"
                    />
                  )}
                </div>
                )}
              </label>
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
                />
              </label>
          </TabsContent>

          <TabsContent value="existing" className="mt-4 space-y-3">
              <ListToolbar
                search={search}
                onSearchChange={setSearch}
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
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
