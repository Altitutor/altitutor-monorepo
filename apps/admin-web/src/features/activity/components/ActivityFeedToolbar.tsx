"use client";

import type { ReactNode } from "react";
import { DataTableToolbar } from "@altitutor/ui";
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
  kind = "events",
  timeBasis,
  onSortChange,
  displayContent,
  direction,
  className,
}: {
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
  onViewApply?: (filters: ActivityFilters) => void;
  search: string;
  onSearchChange: (search: string) => void;
  kind?: "events" | "communication" | "messages";
  timeBasis?: CommunicationTimeSort;
  onSortChange?: (basis: CommunicationTimeSort, direction: "asc" | "desc") => void;
  displayContent?: ReactNode;
  direction: "asc" | "desc";
  className?: string;
}) {
  const target = kind === "events" ? viewTarget : `${kind}-activity-feed`;
  const { data: savedViews = [] } = useQuickFilters(target);
  const builtInViews = presets.slice(
    0,
    kind === "events" ? 1 : kind === "messages" ? 2 : 3,
  );
  const types =
    kind === "events"
      ? activityTypes
      : kind === "messages"
        ? communicationTypes.filter(({ value }) => value.startsWith("message:"))
        : [...activityTypes, ...communicationTypes];

  return (
    <DataTableToolbar
      className={className}
      compact={kind !== "events"}
      viewTarget={target}
      quickFilters={[...builtInViews, ...savedViews]}
      state={{
        search,
        filters,
        sortBy: onSortChange ? timeBasis ?? "logged" : null,
        sortDirection: direction,
        groupBy: null,
        page: 1,
        pageSize: 50,
        visibleColumns: [],
      }}
      onSearchChange={onSearchChange}
      onFiltersChange={onFiltersChange}
      sortOptions={onSortChange ? [
        { key: "logged", label: "Time logged" },
        { key: "effective", label: "Effective time" },
      ] : undefined}
      onSortChange={(key, order) =>
        onSortChange?.(key === "effective" ? "effective" : "logged", order)
      }
      displayTooltip="Display options"
      onGroupByChange={() => {}}
      onVisibleColumnsChange={() => {}}
      onQuickFilterApply={(view) => {
        const settings = getViewSettings(view.config);
        if (!settings) return;
        (onViewApply ?? onFiltersChange)(settings.filters);
        onSortChange?.(
          settings.sortBy === "effective" ? "effective" : "logged",
          settings.sortDirection,
        );
      }}
      onReset={() => {
        (onViewApply ?? onFiltersChange)({});
        onSortChange?.("logged", "asc");
      }}
      filterDefinitions={[
        {
          key: "type",
          label: "Activity type",
          options: types,
        },
        dateFilter,
      ]}
      viewContent={displayContent}
      searchPlaceholder="Search activity…"
    />
  );
}
