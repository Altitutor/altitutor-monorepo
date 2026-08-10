'use client'

import { useMemo, useState } from 'react'
import {
  Button,
  Input,
  SearchableSelect,
  Tabs,
  TabsContent,
} from '@altitutor/ui'
import { Pencil, Trash2 } from 'lucide-react'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import type { RichTextJson } from '@/features/ucat/shared/types'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { UcatVisibilityFieldLabel } from '@/features/ucat/shared/components/UcatVisibilityInfoTooltip'
import { UcatSetCatalogListPanel } from '@/features/ucat/shared/components/ucat-set-catalog-panel'
import { SegmentedControl } from '@/shared/components/segmented-control'
import {
  UcatAuthoringWorkspaceTabs,
  type UcatAuthoringWorkspaceTab,
} from '@/features/ucat/shared/components/UcatAuthoringWorkspaceTabs'
import { cn } from '@/shared/utils'
import { UcatBlueprintCompliancePanel } from '@/features/ucat/mocks/components/UcatBlueprintCompliancePanel'
import type { StoredBlueprintCompliance } from '@/features/ucat/mocks/lib/blueprint-compliance'
import type { StoredMockBlueprintAudit } from '@/features/ucat/mocks/lib/blueprint-compliance'

type UcatMockEditorContentProps = {
  name: string
  isPrivate: boolean
  instructionsText: RichTextJson | null
  setInstructionsText: (value: RichTextJson | null) => void
  setName: (value: string) => void
  setIsPrivate: (value: boolean) => void
  draftSetIds: string[]
  setDraftSetIds: (ids: string[]) => void
  search: string
  setSearch: (value: string) => void
  filters: Record<string, unknown[]>
  setFilters: (value: Record<string, unknown[]>) => void
  filterDefinitions: DataTableFilterDefinition[]
  filterSearchValues?: Record<string, string>
  onFilterSearchChange?: (filterKey: string, value: string) => void
  setCatalog: SetOption[]
  setCatalogLoading?: boolean
  sections?: Array<{
    id: string | null
    section_number: number | null
    name: string | null
    number_of_questions: number | null
    time_limit_seconds: number | null
  }>
  onEditSet?: (setId: string) => void
  blueprints?: Array<{ id: string; code: string; test_year: number; version: number }>
  attachedBlueprintId: string | null
  candidateBlueprintId: string | null
  setCandidateBlueprintId: (value: string | null) => void
  blueprintCompliance: StoredBlueprintCompliance | null
  latestCandidateAudit: StoredMockBlueprintAudit | null
  auditPending: boolean
  confirmPending: boolean
  onAuditCandidate: () => void
  onConfirmCandidate: () => void
}

export function UcatMockEditorContent({
  name,
  isPrivate,
  instructionsText,
  setInstructionsText,
  setName,
  setIsPrivate,
  draftSetIds,
  setDraftSetIds,
  search,
  setSearch,
  filters,
  setFilters,
  filterDefinitions,
  filterSearchValues,
  onFilterSearchChange,
  setCatalog,
  setCatalogLoading = false,
  sections = [],
  onEditSet,
  blueprints = [],
  attachedBlueprintId,
  candidateBlueprintId,
  setCandidateBlueprintId,
  blueprintCompliance,
  latestCandidateAudit,
  auditPending,
  confirmPending,
  onAuditCandidate,
  onConfirmCandidate,
}: UcatMockEditorContentProps) {
  const [sideTab, setSideTab] = useState<'properties' | 'add-sets'>('properties')
  const [activeWorkspace, setActiveWorkspace] = useState<UcatAuthoringWorkspaceTab>('editor')
  const orderedSections = useMemo(
    () => [...sections].sort((a, b) => (a.section_number ?? 0) - (b.section_number ?? 0)),
    [sections],
  )
  const setById = useMemo(() => new Map(setCatalog.map((set) => [set.id, set])), [setCatalog])
  const occupiedSectionNumbers = useMemo(
    () => new Set(
      draftSetIds
        .map((id) => setById.get(id))
        .filter((set): set is SetOption => set?.sectionCount === 1 && set.firstSectionNumber != null)
        .map((set) => set.firstSectionNumber as number),
    ),
    [draftSetIds, setById],
  )
  const availableSets = useMemo(
    () => setCatalog.filter((set) =>
      set.sectionCount === 1 &&
      set.firstSectionNumber != null &&
      !occupiedSectionNumbers.has(set.firstSectionNumber),
    ),
    [setCatalog, occupiedSectionNumbers],
  )

  function removeSet(setId: string) {
    setDraftSetIds(draftSetIds.filter((id) => id !== setId))
  }

  function addSet(setId: string) {
    const nextIds = [...draftSetIds, setId]
    nextIds.sort((leftId, rightId) => {
      const left = setById.get(leftId)?.firstSectionNumber ?? Number.MAX_SAFE_INTEGER
      const right = setById.get(rightId)?.firstSectionNumber ?? Number.MAX_SAFE_INTEGER
      return left - right
    })
    setDraftSetIds(nextIds)
  }

  function handleWorkspaceChange(value: UcatAuthoringWorkspaceTab) {
    setActiveWorkspace(value)
    if (value === 'properties') setSideTab('properties')
    if (value === 'ai') setSideTab('add-sets')
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <UcatAuthoringWorkspaceTabs
        value={activeWorkspace}
        onValueChange={handleWorkspaceChange}
        editorLabel="Sections"
        aiLabel="Add sets"
        className="shrink-0 border-b bg-background p-2 lg:hidden"
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <section className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-4 lg:flex lg:border-r lg:p-6',
        activeWorkspace !== 'editor' && 'hidden',
      )}>
        <h2 className="mb-1 shrink-0 font-semibold">Mock sections</h2>
        <p className="mb-4 text-sm text-muted-foreground">Choose one set for each UCAT section.</p>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {orderedSections.map((section) => {
            const assignedSets = draftSetIds
              .map((id) => setById.get(id))
              .filter((set): set is SetOption =>
                set?.firstSectionNumber === section.section_number,
              )
            const label = section.section_number != null
              ? `Section ${section.section_number}: ${section.name ?? 'Untitled section'}`
              : section.name ?? 'Untitled section'

            return (
              <div key={section.id ?? label} className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <span className="text-xs text-muted-foreground">
                    {section.number_of_questions ?? '—'} questions · {section.time_limit_seconds ?? '—'}s
                  </span>
                </div>
                {assignedSets.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-background px-3 py-4 text-sm text-muted-foreground">
                    No set selected
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignedSets.map((set) => (
                      <div key={set.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{set.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {set.question_count ?? '—'} questions · {set.time_limit_seconds ?? '—'}s
                          </p>
                          {set.sectionCount !== 1 ? (
                            <p className="mt-1 text-xs font-medium text-destructive">This set spans multiple sections and cannot be published in a mock.</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {onEditSet ? (
                            <Button type="button" variant="ghost" size="icon" onClick={() => onEditSet(set.id)} aria-label={`Edit ${set.name}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeSet(set.id)} aria-label={`Remove ${set.name}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {assignedSets.length > 1 ? (
                      <p className="text-xs font-medium text-destructive">Remove duplicates; only one set is allowed for this section.</p>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
          {orderedSections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No UCAT sections are configured.</p>
          ) : null}
        </div>
      </section>

      <aside className={cn(
        'h-full min-h-0 w-full shrink-0 flex-col overflow-hidden bg-background p-3 sm:p-4 lg:flex lg:w-80 lg:border-l',
        activeWorkspace === 'editor' && 'hidden',
        activeWorkspace !== 'editor' && 'flex',
      )}>
        <Tabs
          value={sideTab}
          onValueChange={(value) => setSideTab(value as 'properties' | 'add-sets')}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="hidden lg:block">
            <SegmentedControl
              fullWidth
              value={sideTab}
              onValueChange={setSideTab}
              options={[
                { value: 'properties', label: 'Properties' },
                { value: 'add-sets', label: 'Add sets' },
              ]}
            />
          </div>
          <TabsContent value="properties" className="m-0 mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pt-1">
            <h2 className="font-semibold">Mock properties</h2>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Full-mock blueprint</span>
              <SearchableSelect<{ value: string; label: string }>
                items={[
                  { value: 'none', label: 'None — focused or ordinary practice' },
                  ...blueprints.map(blueprint => ({
                    value: blueprint.id,
                    label: `${blueprint.test_year} v${blueprint.version} · ${blueprint.code}`,
                  })),
                ]}
                value={candidateBlueprintId == null
                  ? { value: 'none', label: 'None — focused or ordinary practice' }
                  : (() => {
                      const blueprint = blueprints.find(candidate => candidate.id === candidateBlueprintId)
                      return blueprint
                        ? { value: blueprint.id, label: `${blueprint.test_year} v${blueprint.version} · ${blueprint.code}` }
                        : null
                    })()}
                onValueChange={(item) => setCandidateBlueprintId(item?.value === 'none' ? null : item?.value ?? null)}
                getItemLabel={(item) => item.label}
                getItemId={(item) => item.value}
              />
            </label>
            <UcatBlueprintCompliancePanel compliance={blueprintCompliance} />
            {candidateBlueprintId ? (
              <div className="space-y-2 rounded-lg border p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">Eligibility audit</p>
                  <span className="text-muted-foreground">
                    {candidateBlueprintId === attachedBlueprintId ? 'Attached candidate' : 'Not attached'}
                  </span>
                </div>
                {latestCandidateAudit ? (
                  <div className="space-y-1">
                    <p className="font-medium capitalize">{latestCandidateAudit.decision}</p>
                    <p className="text-muted-foreground">Checked {new Date(latestCandidateAudit.checkedAt).toLocaleString()}</p>
                    <p>{latestCandidateAudit.gateResults.publicationState.reason}</p>
                    <p>{latestCandidateAudit.gateResults.sectionPurity.reason}</p>
                    <p>{latestCandidateAudit.gateResults.provisionalMetadata.reason}</p>
                    <div className="pt-1">
                      <p className="mb-2 font-semibold">Stored audit snapshot</p>
                      <UcatBlueprintCompliancePanel compliance={latestCandidateAudit.gateResults.compliance} />
                    </div>
                  </div>
                ) : <p className="text-muted-foreground">Run the durable audit before attaching this blueprint.</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={onAuditCandidate} disabled={auditPending}>
                    {auditPending ? 'Auditing…' : 'Run audit'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={onConfirmCandidate}
                    disabled={confirmPending || latestCandidateAudit?.decision !== 'eligible' || candidateBlueprintId === attachedBlueprintId}
                  >
                    {confirmPending ? 'Confirming…' : 'Confirm and attach'}
                  </Button>
                </div>
                {latestCandidateAudit?.decision === 'provisional' ? (
                  <p className="font-medium text-amber-700">Review the unresolved category or presentation metadata, then run the audit again.</p>
                ) : null}
              </div>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                <UcatVisibilityFieldLabel />
              </span>
              <SearchableSelect<{ value: string; label: string }>
                items={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                ]}
                value={
                  isPrivate
                    ? { value: 'private', label: 'Private' }
                    : { value: 'public', label: 'Public' }
                }
                onValueChange={(item) => item && setIsPrivate(item.value === 'private')}
                getItemLabel={(i) => i.label}
                getItemId={(i) => i.value}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Instructions</span>
              <p className="mb-1 text-xs text-muted-foreground">
                Shown to students at the start of the mock before set instructions.
              </p>
              <div className="overflow-hidden rounded-md border border-input bg-background px-2 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <UcatRichTextEditor
                  value={instructionsText}
                  onChange={(value) => setInstructionsText(value)}
                  placeholder="Optional mock instructions..."
                  minHeight="120px"
                />
              </div>
            </label>
          </TabsContent>
          <TabsContent value="add-sets" className="m-0 mt-3 min-h-0 flex-1 flex-col data-[state=active]:flex">
            <UcatSetCatalogListPanel
              sets={availableSets}
              excludedIds={draftSetIds}
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFiltersChange={setFilters}
              filterDefinitions={filterDefinitions}
              filterSearchValues={filterSearchValues}
              onFilterSearchChange={onFilterSearchChange}
              sections={sections}
              isLoading={setCatalogLoading}
              emptyMessage="No eligible sets remain. Each section can have only one set."
              onAddSet={addSet}
              onEditSet={onEditSet}
            />
          </TabsContent>
        </Tabs>
      </aside>
      </div>
    </div>
  )
}
