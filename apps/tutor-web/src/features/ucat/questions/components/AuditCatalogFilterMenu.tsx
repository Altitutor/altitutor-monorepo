"use client";

import { useMemo, useState } from "react";
import {
  Checkbox,
  Input,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@altitutor/ui";
import { ChevronDown, Search } from "lucide-react";
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
} from "@/features/ucat/questions/lib/audit-catalog";

type AuditCatalogFilterMenuProps = {
  runs: CatalogAuditRun[];
  selectedValues: string[];
  onSelectedValuesChange: (values: string[]) => void;
};

export function AuditCatalogFilterMenu({
  runs,
  selectedValues,
  onSelectedValuesChange,
}: AuditCatalogFilterMenuProps) {
  const [query, setQuery] = useState("");
  const visibleRuns = useMemo(() => catalogAuditRunsForFilter(runs), [runs]);
  const filteredRuns = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return visibleRuns;
    return visibleRuns.filter((run) =>
      auditRunOptionPrefix(run, visibleRuns).toLowerCase().includes(needle),
    );
  }, [query, visibleRuns]);

  const notAuditedSelected = selectedValues.includes(AUDIT_CATALOG_NOT_AUDITED);

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
        <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
          <Checkbox
            checked={notAuditedSelected}
            onCheckedChange={() =>
              onSelectedValuesChange(
                notAuditedSelected
                  ? selectedValues.filter(
                      (value) => value !== AUDIT_CATALOG_NOT_AUDITED,
                    )
                  : [...selectedValues, AUDIT_CATALOG_NOT_AUDITED],
              )
            }
          />
          Not audited
        </label>
        {filteredRuns.length > 0 ? <hr className="my-1 border-border" /> : null}
        {filteredRuns.map((run) => {
          const prefix = auditRunOptionPrefix(run, visibleRuns);
          const selectedStatuses = selectedStatusesForAuditRun(
            selectedValues,
            run.id,
          );
          const fullySelected = isAuditRunFullySelected(selectedValues, run.id);
          const partiallySelected =
            selectedStatuses.length > 0 && !fullySelected;
          return (
            <div
              key={run.id}
              className="flex items-center gap-1 rounded px-2 py-1 hover:bg-muted"
            >
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <Checkbox
                  checked={
                    fullySelected
                      ? true
                      : partiallySelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={() =>
                    onSelectedValuesChange(
                      toggleAuditRunFilter(selectedValues, run.id),
                    )
                  }
                />
                <span className="truncate">{prefix}</span>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5"
                    aria-label={`Choose statuses for ${prefix}`}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  {AUDIT_TARGET_STATUSES.map((status) => (
                    <label
                      key={status}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={selectedStatuses.includes(status)}
                        onCheckedChange={() =>
                          onSelectedValuesChange(
                            toggleAuditRunStatusFilter(
                              selectedValues,
                              run.id,
                              status,
                            ),
                          )
                        }
                      />
                      {AUDIT_TARGET_STATUS_LABELS[status]}
                    </label>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
          );
        })}
        {filteredRuns.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No audits found
          </p>
        ) : null}
      </div>
    </div>
  );
}
