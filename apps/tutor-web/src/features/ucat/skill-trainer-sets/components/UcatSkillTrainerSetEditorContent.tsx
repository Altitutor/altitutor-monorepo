'use client'

import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Input,
  ListToolbar,
  SearchableSelect,
  Textarea,
} from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { Pencil, Plus } from 'lucide-react'
import type { UcatSkillTrainerItemRow } from '@/features/ucat/skill-trainer/api/items'
import { skillTrainerItemContentSummary } from '@/features/ucat/skill-trainer/lib/content-summary'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'
import { cn } from '@/shared/utils'
import { tutorBtnIconOutline, tutorBtnPrimary } from '@/shared/lib/tutor-visual'
import {
  SegmentedTabPanel,
  SegmentedTabPanelContent,
} from '@/shared/components/segmented-tab-panel'

type UcatSkillTrainerSetEditorContentProps = {
  name: string
  description: string
  trainerName: string
  isPrivate: boolean
  itemIds: string[]
  onItemIdsChange: (itemIds: string[]) => void
  onAddItem: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  trainerItems: UcatSkillTrainerItemRow[]
  unusedItems: UcatSkillTrainerItemRow[]
  onChangeName: (value: string) => void
  onChangeDescription: (value: string) => void
  onChangePrivate: (value: boolean) => void
  onEditItem?: (itemId: string) => void
}

function AvailableItemRow({
  item,
  onAdd,
  onEdit,
}: {
  item: UcatSkillTrainerItemRow
  onAdd: () => void
  onEdit: () => void
}) {
  const summary = skillTrainerItemContentSummary(item)

  return (
    <div className="flex w-full items-start justify-between gap-2 rounded border px-2 py-2 text-left text-sm hover:bg-muted">
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 break-words text-xs sm:text-sm">{summary}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
            {item.approval_status}
          </Badge>
          {!item.is_active ? (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
              Inactive
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(tutorBtnIconOutline, 'text-muted-foreground hover:text-foreground')}
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="default"
          size="icon"
          className={cn(tutorBtnPrimary, 'shrink-0')}
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function UcatSkillTrainerSetEditorContent({
  name,
  description,
  trainerName,
  isPrivate,
  itemIds,
  onItemIdsChange,
  onAddItem,
  onRemoveItem,
  trainerItems,
  unusedItems,
  onChangeName,
  onChangeDescription,
  onChangePrivate,
  onEditItem,
}: UcatSkillTrainerSetEditorContentProps) {
  const [sideTab, setSideTab] = useState<'properties' | 'add-questions'>('properties')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      {
        key: 'approval_status',
        label: 'Approval',
        options: [
          { label: 'Approved', value: 'approved' },
          { label: 'Pending', value: 'pending' },
          { label: 'Rejected', value: 'rejected' },
        ],
      },
      {
        key: 'is_active',
        label: 'Active',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
    ],
    [],
  )

  const availableItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    const approvalFilter = filters.approval_status?.[0] as string | undefined
    const activeFilter = filters.is_active?.[0] as string | undefined

    return unusedItems
      .filter((item) => {
        if (query.length > 0) {
          const summary = skillTrainerItemContentSummary(item).toLowerCase()
          if (!summary.includes(query)) return false
        }
        if (approvalFilter && approvalFilter !== 'all' && item.approval_status !== approvalFilter) {
          return false
        }
        if (activeFilter && activeFilter !== 'all') {
          if (activeFilter === 'active' && !item.is_active) return false
          if (activeFilter === 'inactive' && item.is_active) return false
        }
        return true
      })
      .slice(0, 60)
  }, [unusedItems, search, filters])

  const itemById = useMemo(() => {
    const map = new Map<string, UcatSkillTrainerItemRow>()
    for (const item of trainerItems) {
      map.set(item.id, item)
    }
    return map
  }, [trainerItems])

  return (
    <div className="flex h-full min-h-0">
      <section className="min-w-0 flex-1 space-y-3 overflow-y-auto border-r p-6">
        <h2 className="font-semibold">Questions in set</h2>
        {itemIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No questions in this set yet.</p>
        ) : (
          <UcatSortableList
            ids={itemIds}
            onChange={onItemIdsChange}
            onRemove={onRemoveItem}
            onEdit={onEditItem}
            renderLabel={(id, index) => {
              const item = itemById.get(id)
              const summary = item ? skillTrainerItemContentSummary(item) : id.slice(0, 8)
              return (
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-xs font-medium">{index + 1}.</span>
                  <div className="min-w-0">
                    <div className="line-clamp-2 break-words text-xs sm:text-sm">{summary}</div>
                    {item ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                          {item.approval_status}
                        </Badge>
                        {!item.is_active ? (
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                            Inactive
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            }}
          />
        )}
      </section>

      <aside className="flex h-full w-96 shrink-0 flex-col overflow-hidden border-l p-6">
        <SegmentedTabPanel
          value={sideTab}
          onValueChange={(value) => setSideTab(value)}
          className="min-h-0 flex-1"
          options={[
            { value: 'properties', label: 'Properties' },
            { value: 'add-questions', label: 'Add questions' },
          ]}
        >
          <SegmentedTabPanelContent
            when="properties"
            activeTab={sideTab}
            className="m-0 mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pt-4"
          >
            <h2 className="font-semibold">Set properties</h2>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Trainer</span>
              <Input value={trainerName} disabled />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Name</span>
              <Input value={name} onChange={(e) => onChangeName(e.target.value)} placeholder="Set name" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Description</span>
              <Textarea
                className="min-h-24"
                value={description}
                onChange={(e) => onChangeDescription(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Visibility</span>
              <SearchableSelect<{ value: string; label: string }>
                items={[
                  { value: 'public', label: 'Public' },
                  { value: 'private', label: 'Private' },
                ]}
                value={isPrivate ? { value: 'private', label: 'Private' } : { value: 'public', label: 'Public' }}
                onValueChange={(item) => item && onChangePrivate(item.value === 'private')}
                getItemLabel={(i) => i.label}
                getItemId={(i) => i.value}
              />
            </label>
          </SegmentedTabPanelContent>
          <SegmentedTabPanelContent
            when="add-questions"
            activeTab={sideTab}
            className="m-0 mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden pt-4"
          >
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search questions"
              filterDefinitions={filterDefinitions}
              filters={filters}
              onFiltersChange={setFilters}
            />
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {availableItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No questions to add, or all matching questions are already in the set.
                </p>
              ) : (
                availableItems.map((item) => (
                  <AvailableItemRow
                    key={item.id}
                    item={item}
                    onAdd={() => onAddItem(item.id)}
                    onEdit={() => onEditItem?.(item.id)}
                  />
                ))
              )}
            </div>
          </SegmentedTabPanelContent>
        </SegmentedTabPanel>
      </aside>
    </div>
  )
}
