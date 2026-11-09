"use client";

import { Button, DataTableToolbar } from "@altitutor/ui";
import {
  getViewSettings,
  type DataTableFilterDefinition,
  type QuickFilter,
} from "@altitutor/shared";
import {
  activityTypes,
  communicationTypes,
  type ActivityFilters,
} from "../lib/activityFeedFilters";
import { useQuickFilters } from "@/features/quick-filters/hooks/useQuickFilters";
import type { CommunicationTimeSort } from "../lib/entityCommunication";

const viewTarget = "activity-feed";
const presetDefinitions: Array<{ name: string; config: ActivityFilters }> = [
  { name: "All", config: {} },
  {
    name: "Messages",
    config: {
      scope: ["direct"],
      type: communicationTypes
        .filter(({ value }) => value.startsWith("message:"))
        .map(({ value }) => value),
    },
  },
  {
    name: "Emails",
    config: {
      type: communicationTypes
        .filter(({ value }) => value.startsWith("email:"))
        .map(({ value }) => value),
    },
  },
];
const presets: QuickFilter[] = presetDefinitions.map(({ name, config }) => ({
  id: `builtin:activity-feed:${name.toLowerCase()}`,
  name,
  config,
  target_entity: viewTarget,
  user_id: null,
  created_at: "",
  updated_at: "",
}));

export const messageActivityFilters: ActivityFilters = presets[1].config;

const dateFilter: DataTableFilterDefinition = {
  key: "date",
  label: "Date",
  type: "date-range",
  fromKey: "from",
  toKey: "to",
};

export function ActivityFeedToolbar({
  filters,
  onFiltersChange,
  onViewApply,
  search,
  onSearchChange,
  communication = false,
  timeBasis,
  onTimeBasisChange,
  direction,
  onDirectionChange,
  className,
}: {
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
  onViewApply?: (filters: ActivityFilters) => void;
  search: string;
  onSearchChange: (search: string) => void;
  communication?: boolean;
  timeBasis: CommunicationTimeSort;
  onTimeBasisChange: (basis: CommunicationTimeSort) => void;
  direction: "asc" | "desc";
  onDirectionChange?: (direction: "asc" | "desc") => void;
  className?: string;
}) {
  const target = communication ? "communication-activity-feed" : viewTarget;
  const { data: savedViews = [] } = useQuickFilters(target);
  const builtInViews = communication ? presets : presets.slice(0, 1);

  return (
    <DataTableToolbar
      className={className}
      compact={communication}
      viewTarget={target}
      quickFilters={[...builtInViews, ...savedViews]}
      state={{
        search,
        filters,
        sortBy: timeBasis === "effective" ? "effective" : null,
        sortDirection: direction,
        groupBy: null,
        page: 1,
        pageSize: 50,
        visibleColumns: [],
      }}
      onSearchChange={onSearchChange}
      onFiltersChange={onFiltersChange}
      onSortChange={(field, sortDirection) => {
        onTimeBasisChange(field === "effective" ? "effective" : "logged");
        onDirectionChange?.(sortDirection);
      }}
      onGroupByChange={() => {}}
      onVisibleColumnsChange={() => {}}
      onQuickFilterApply={(view) => {
        const settings = getViewSettings(view.config);
        if (!settings) return;
        (onViewApply ?? onFiltersChange)(settings.filters);
        onTimeBasisChange(
          settings.sortBy === "effective" ? "effective" : "logged",
        );
        onDirectionChange?.(settings.sortDirection);
      }}
      onReset={() => {
        onFiltersChange({});
        onTimeBasisChange("logged");
      }}
      filterDefinitions={[
        {
          key: "type",
          label: "Activity type",
          options: communication
            ? [...activityTypes, ...communicationTypes]
            : activityTypes,
        },
        dateFilter,
      ]}
      sortOptions={
        onDirectionChange
          ? [
              { key: "logged", label: "Time logged" },
              { key: "effective", label: "Effective time" },
            ]
          : undefined
      }
      viewContent={
        communication ? (
          <div
            className="flex flex-wrap gap-2 px-4 py-2"
            role="group"
            aria-label="Activity time"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={timeBasis === "logged"}
              onClick={() => onTimeBasisChange("logged")}
            >
              Time logged
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={timeBasis === "effective"}
              onClick={() => onTimeBasisChange("effective")}
            >
              Effective time
            </Button>
          </div>
        ) : undefined
      }
      searchPlaceholder="Search activity…"
    />
  );
}
