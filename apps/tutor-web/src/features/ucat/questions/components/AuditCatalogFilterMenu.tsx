'use client'

import { useMemo, useState } from 'react'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  Input,
} from '@altitutor/ui'
import { Check, Minus, Search } from 'lucide-react'
import {
  AUDIT_CATALOG_NOT_AUDITED,
  AUDIT_TARGET_STATUS_LABELS,
  AUDIT_TARGET_STATUSES,
  auditRunOptionPrefix,
  catalogAuditRunsForFilter,
  isAuditRunFullySelected,
  selectedStatusesForAuditRun,
  toggleAuditRunFilter,
  toggleAuditRunStatusFilter,
  type CatalogAuditRun,
} from '@/features/ucat/questions/lib/audit-catalog'

type AuditCatalogFilterMenuProps = {
  runs: CatalogAuditRun[]
  selectedValues: string[]
  onSelectedValuesChange: (values: string[]) => void
}

export function AuditCatalogFilterMenu({
  runs,
  selectedValues,
  onSelectedValuesChange,
}: AuditCatalogFilterMenuProps) {
  const [query, setQuery] = useState('')
  const visibleRuns = useMemo(() => catalogAuditRunsForFilter(runs), [runs])
  const filteredRuns = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return visibleRuns
    return visibleRuns.filter((run) =>
      auditRunOptionPrefix(run, visibleRuns).toLowerCase().includes(needle),
    )
  }, [query, visibleRuns])

  const notAuditedSelected = selectedValues.includes(AUDIT_CATALOG_NOT_AUDITED)

  return (
    <div className="flex max-h-80 flex-col">
      <div className="relative border-b p-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          placeholder="Search audits..."
          className="h-8 pl-8"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        <DropdownMenuCheckboxItem
          checked={notAuditedSelected}
          onCheckedChange={() => {
            onSelectedValuesChange(
              notAuditedSelected
                ? selectedValues.filter((value) => value !== AUDIT_CATALOG_NOT_AUDITED)
                : [...selectedValues, AUDIT_CATALOG_NOT_AUDITED],
            )
          }}
          onSelect={(event) => event.preventDefault()}
        >
          Not audited
        </DropdownMenuCheckboxItem>
        {filteredRuns.length > 0 ? <DropdownMenuSeparator /> : null}
        {filteredRuns.map((run) => {
          const prefix = auditRunOptionPrefix(run, visibleRuns)
          const selectedStatuses = selectedStatusesForAuditRun(selectedValues, run.id)
          const fullySelected = isAuditRunFullySelected(selectedValues, run.id)
          const partiallySelected = selectedStatuses.length > 0 && !fullySelected
          return (
            <DropdownMenuSub
              key={run.id}
              persistOpenOnRemountKey={`audit-catalog-run:${run.id}`}
            >
              <DropdownMenuSubTrigger className="relative py-1.5 pl-8 pr-2">
                <span
                  className="absolute inset-y-0 left-0 right-6 flex items-center pl-8"
                  onPointerDown={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onSelectedValuesChange(toggleAuditRunFilter(selectedValues, run.id))
                  }}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {fullySelected ? <Check className="h-4 w-4" /> : null}
                    {partiallySelected ? <Minus className="h-4 w-4" /> : null}
                  </span>
                  <span className="truncate">{prefix}</span>
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {AUDIT_TARGET_STATUSES.map((status) => {
                  const checked = selectedStatuses.includes(status)
                  return (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={checked}
                      onCheckedChange={() => {
                        onSelectedValuesChange(
                          toggleAuditRunStatusFilter(selectedValues, run.id, status),
                        )
                      }}
                      onSelect={(event) => event.preventDefault()}
                    >
                      {AUDIT_TARGET_STATUS_LABELS[status]}
                    </DropdownMenuCheckboxItem>
                  )
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )
        })}
        {filteredRuns.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No audits found</p>
        ) : null}
      </div>
    </div>
  )
}
