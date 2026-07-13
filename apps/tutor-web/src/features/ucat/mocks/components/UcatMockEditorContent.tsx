'use client'

import { useState } from 'react'
import {
  Input,
  SearchableSelect,
} from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import type { RichTextJson } from '@/features/ucat/shared/types'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { UcatVisibilityFieldLabel } from '@/features/ucat/shared/components/UcatVisibilityInfoTooltip'
import {
  UcatSetCatalogListPanel,
  UcatSetMembershipListPanel,
} from '@/features/ucat/shared/components/ucat-set-catalog-panel'
import {
  SegmentedTabPanel,
  SegmentedTabPanelContent,
} from '@/shared/components/segmented-tab-panel'

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
}: UcatMockEditorContentProps) {
  const [sideTab, setSideTab] = useState<'properties' | 'add-sets'>('properties')

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-r p-6">
        <h2 className="mb-3 shrink-0 font-semibold">Sets in mock</h2>
        <UcatSetMembershipListPanel
          setIds={draftSetIds}
          onSetIdsChange={setDraftSetIds}
          sets={setCatalog}
          filterDefinitions={filterDefinitions}
          filterSearchValues={filterSearchValues}
          onFilterSearchChange={onFilterSearchChange}
          sections={sections}
          onEditSet={onEditSet}
          className="min-h-0 flex-1"
        />
      </section>

      <aside className="flex h-full min-h-0 w-96 shrink-0 flex-col overflow-hidden border-l p-6">
        <SegmentedTabPanel
          value={sideTab}
          onValueChange={(value) => setSideTab(value)}
          className="min-h-0 flex-1"
          options={[
            { value: 'properties', label: 'Properties' },
            { value: 'add-sets', label: 'Add sets' },
          ]}
        >
          <SegmentedTabPanelContent
            when="properties"
            activeTab={sideTab}
            className="m-0 mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pt-4"
          >
            <h2 className="font-semibold">Mock properties</h2>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
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
          </SegmentedTabPanelContent>
          <SegmentedTabPanelContent
            when="add-sets"
            activeTab={sideTab}
            className="m-0 mt-3 flex min-h-0 flex-1 flex-col pt-2"
          >
            <UcatSetCatalogListPanel
              sets={setCatalog}
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
              onAddSet={(setId) => setDraftSetIds([...draftSetIds, setId])}
              onEditSet={onEditSet}
            />
          </SegmentedTabPanelContent>
        </SegmentedTabPanel>
      </aside>
    </div>
  )
}
