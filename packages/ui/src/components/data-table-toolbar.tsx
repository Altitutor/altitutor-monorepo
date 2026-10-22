"use client";

import {
  encodeViewConfig,
  readViewSettings,
  type DisplaySettings,
  type SavedView,
} from "@altitutor/shared";
import { ToolbarSavedViews, useMatchingView } from "./toolbar-saved-views";
import type { ToolbarView } from "./toolbar-view";

import * as React from "react";
import { useMediaQuery } from "../hooks/use-media-query";
import {
  LayoutGrid,
  List,
  ArrowUp,
  ArrowDown,
  X,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type {
  DataTableState,
  QuickFilter,
  DataTableFilterDefinition,
  DataTableSortOption,
  DataTableGroupByOption,
  DataTableColumnDefinition,
} from "@altitutor/shared";
import { useDebounce } from "@altitutor/shared/hooks";
import { Button } from "./button";
import { Input } from "./input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { ToolbarSelectRow } from "./toolbar-select-row";
import { SearchableSelectInline } from "./searchable-select-inline";
export type { ToolbarFilterEditorContext } from "./toolbar-filters";
import { ToolbarAddFilter, ToolbarFilterPills } from "./toolbar-filters";
import type { ToolbarConditionFilters } from "./toolbar-filter-pill";
import {
  toolbarControlSelectedStyles,
  toolbarControlStyles,
  toolbarControlUnselectedStyles,
} from "../lib/toolbar-control-styles";
import { cn } from "../lib/cn";
import { useRemountPersistentState } from "../hooks/use-remount-persistent-state";
import {
  canResolveDefaultVisibleColumns,
  countColumnViewLayoutDiff,
  countVisibleColumnLayoutDiff,
  ensureAtLeastOneVisibleColumn,
  resolveDefaultVisibleColumns,
} from "../lib/column-view-layout";

export interface DataTableToolbarProps {
  viewTarget?: string;
  filterStateAdapter?: {
    read: (stored: Record<string, unknown[]>) => Record<string, unknown[]>;
    write: (toolbar: Record<string, unknown[]>) => Record<string, unknown[]>;
  };
  displayInline?: boolean;
  hideViews?: boolean;
  columnHeading?: string;
  conditionFilters?: ToolbarConditionFilters;
  view?: ToolbarView;
  viewContent?: React.ReactNode;
  allowEmptyColumns?: boolean;
  groupByRequired?: boolean;
  state: DataTableState;
  onSearchChange: (value: string) => void;
  onFiltersChange: (filters: Record<string, unknown[]>) => void;
  onSortChange: (field: string | null, direction: "asc" | "desc") => void;
  onGroupByChange: (field: string | null) => void;
  onVisibleColumnsChange: (columns: string[]) => void;
  onQuickFilterApply: (qf: QuickFilter) => void;
  onReset: () => void;

  filterDefinitions?: DataTableFilterDefinition[];
  sortOptions?: DataTableSortOption[];
  groupByOptions?: DataTableGroupByOption[];
  columnDefinitions?: DataTableColumnDefinition[];
  /** Default visible columns; when omitted, derived from columnDefinitions.visibleByDefault when set */
  defaultVisibleColumns?: string[];
  quickFilters?: QuickFilter[];

  className?: string;
  rowClassName?: string;
  searchPlaceholder?: string;
  searchFromOptions?: DataTableSearchFromOption[];
  searchFromValue?: string[];
  onSearchFromChange?: (values: string[]) => void;
  searchContainerClassName?: string;
  searchInputClassName?: string;
  controlClassName?: string;
  isLoading?: boolean;
  filterSearchValues?: Record<string, string>;
  onFilterSearchChange?: (filterKey: string, value: string) => void;
  /** Optional content rendered at the bottom of the Filters dropdown (e.g. "Show deleted" toggle) */
  filterFooter?: React.ReactNode;
  /** When true, "Show deleted" is considered an active filter: button shows count and X clears it */
  showDeletedActive?: boolean;
  /** Called when the user clears the "Show deleted" filter (e.g. via the X button) */
  onClearShowDeleted?: () => void;
  /** Custom filter content for specific keys - renders inside DropdownMenuSub (e.g. SearchableSelectInline) */
  customFilterContent?: Record<
    string,
    import("./toolbar-filters").ToolbarFilterEditor
  >;
  /** When true, the search input is hidden (filters / view / sort remain) */
  hideSearch?: boolean;
  /** Optional content rendered inside the leading edge of the search field. Replaces the default search icon. */
  searchLeadingAccessory?: React.ReactNode;
  /** Optional content rendered beside the search input. */
  searchAccessory?: React.ReactNode;
  /** Icon-only controls for narrow panels (e.g. editor sidebars). */
  compact?: boolean;
  /** When true, search-from toggles appear in the View dropdown instead of beside the search field */
  searchFromInView?: boolean;
  /** Search-from options shown under the Question stems heading (after columns) */
  stemSearchFromOptions?: DataTableSearchFromOption[];
  /** Additional grouped search-from options for the View dropdown (used with searchFromInView) */
  searchFromViewGroups?: Array<{
    heading: string;
    options: DataTableSearchFromOption[];
  }>;
  /** Grouped column visibility sections (e.g. stem / question / answer option columns) */
  columnViewGroups?: DataTableColumnViewGroup[];
}

export interface DataTableColumnViewGroup {
  heading: string;
  columnDefinitions: DataTableColumnDefinition[];
  visibleColumns: string[];
  onVisibleColumnsChange: (columns: string[]) => void;
  /** Default visible columns for this group; when omitted, derived from columnDefinitions.visibleByDefault when set */
  defaultVisibleColumns?: string[];
}

export interface DataTableSearchFromOption {
  label: string;
  value: string;
}

export function DataTableToolbar(props: DataTableToolbarProps) {
  const {
    viewTarget,
    filterStateAdapter,
    displayInline = false,
    hideViews = false,
    state,
    conditionFilters,
    columnHeading = "Show columns",
    view,
    viewContent,
    allowEmptyColumns = false,
    groupByRequired = false,
    onSearchChange,
    onFiltersChange,
    onSortChange,
    onGroupByChange,
    onVisibleColumnsChange,
    onQuickFilterApply,
    filterDefinitions = [],
    sortOptions = [],
    groupByOptions = [],
    columnDefinitions = [],
    defaultVisibleColumns,
    quickFilters = [],
    className,
    rowClassName,
    searchPlaceholder = "Search...",
    searchFromOptions = [],
    searchFromValue,
    onSearchFromChange,
    searchContainerClassName,
    searchInputClassName,
    controlClassName,
    onFilterSearchChange,
    filterFooter,
    showDeletedActive = false,
    onClearShowDeleted,
    customFilterContent = {},
    hideSearch = false,
    searchLeadingAccessory,
    searchAccessory,
    compact: compactProp = false,
    searchFromViewGroups,
    columnViewGroups = [],
  } = props;
  const narrow = !useMediaQuery("(min-width: 768px)");
  const compact = compactProp || narrow;
  const [searchValue, setSearchValue] = React.useState(state.search);
  const debouncedSearch = useDebounce(searchValue, 300);
  const prevStateSearchRef = React.useRef(state.search);
  const isInternalUpdateRef = React.useRef(false);
  const onSearchChangeRef = React.useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;
  const filterPersistenceKey = `data-table-toolbar:filters:${viewTarget ?? quickFilters[0]?.target_entity ?? ""}:${displayInline ? "draft" : "live"}:${typeof window === "undefined" ? "" : window.location.pathname}`;
  const [filterOpen, setFilterOpen] = useRemountPersistentState(
    filterPersistenceKey,
    false,
  );

  // Sync internal search state with prop state (e.g. if cleared from outside)
  // Only sync when state.search changes externally, not during local typing
  React.useEffect(() => {
    // Skip sync if this update came from our own debounced callback
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      prevStateSearchRef.current = state.search;
      return;
    }

    // Only update if state.search changed from an external source
    if (state.search !== prevStateSearchRef.current) {
      setSearchValue(state.search);
      prevStateSearchRef.current = state.search;
    }
  }, [state.search]);

  // Push debounced local search to parent. Keep the callback in a ref so URL-driven
  // parent identity churn (common on tab switches) cannot re-fire this effect and
  // fight an external reset into an update-depth loop.
  React.useEffect(() => {
    if (debouncedSearch === state.search) return;
    isInternalUpdateRef.current = true;
    onSearchChangeRef.current(debouncedSearch);
  }, [debouncedSearch, state.search]);

  const effectiveActiveFilterCount =
    filterDefinitions.filter((definition) =>
      [
        definition.key,
        definition.minKey,
        definition.maxKey,
        definition.fromKey,
        definition.toKey,
      ].some((key) => key && state.filters[key]?.length),
    ).length +
    (conditionFilters?.value.length ?? 0) +
    (showDeletedActive ? 1 : 0);
  const [clearVersion, setClearVersion] = React.useState(0);
  const handleClearAllFilters = () => {
    setClearVersion((version) => version + 1);
    onClearShowDeleted?.();
    onFiltersChange({});
    conditionFilters?.onChange([]);
  };
  const filtersProps = {
    definitions: filterDefinitions,
    filters: state.filters,
    onChange: onFiltersChange,
    conditions: conditionFilters,
    customContent: customFilterContent,
    onSearchChange: onFilterSearchChange,
    persistenceKey: filterPersistenceKey,
    clearVersion,
  };

  const activeSearchFromValues =
    searchFromValue ?? searchFromOptions.map((option) => option.value);
  const searchFromEnabled =
    searchFromOptions.length > 1 && !!onSearchFromChange;
  const searchFromSummary = (() => {
    if (activeSearchFromValues.length === searchFromOptions.length)
      return "All fields";
    if (activeSearchFromValues.length === 1) {
      return (
        searchFromOptions.find(
          (option) => option.value === activeSearchFromValues[0],
        )?.label ?? "Search from"
      );
    }
    return `${activeSearchFromValues.length} fields`;
  })();

  const toggleSearchFromValue = (value: string) => {
    if (!onSearchFromChange) return;
    const next = activeSearchFromValues.includes(value)
      ? activeSearchFromValues.length === 1
        ? activeSearchFromValues
        : activeSearchFromValues.filter((item) => item !== value)
      : [...activeSearchFromValues, value];
    onSearchFromChange(next);
  };

  const labelClass = compact ? "sr-only" : "hidden md:inline";
  const controlBtnClass = (extra?: string) =>
    cn(compact ? "size-9 p-0" : "h-10", controlClassName, extra);
  const iconClass = (extra?: string) =>
    cn("h-4 w-4 shrink-0", !compact && "md:mr-2", extra);

  const searchFromViewGroupsResolved =
    searchFromViewGroups ??
    (searchFromOptions.length > 0
      ? [{ heading: "Search in", options: searchFromOptions }]
      : []);

  const resolvedDefaultVisibleColumns =
    defaultVisibleColumns ?? state.defaultVisibleColumns;

  const handleVisibleColumnsChange = React.useCallback(
    (columns: string[]) => {
      onVisibleColumnsChange(
        allowEmptyColumns
          ? columns
          : ensureAtLeastOneVisibleColumn(
              columns,
              columnDefinitions.map((column) => column.key),
            ),
      );
    },
    [allowEmptyColumns, columnDefinitions, onVisibleColumnsChange],
  );

  const viewLayoutChangeCount = React.useMemo(() => {
    if (columnViewGroups.length > 0) {
      return countColumnViewLayoutDiff(columnViewGroups);
    }
    if (columnDefinitions.length === 0) {
      return 0;
    }
    if (
      !canResolveDefaultVisibleColumns(
        columnDefinitions,
        resolvedDefaultVisibleColumns,
      )
    ) {
      return 0;
    }
    const defaults = resolveDefaultVisibleColumns(
      columnDefinitions,
      resolvedDefaultVisibleColumns,
    );
    return countVisibleColumnLayoutDiff(state.visibleColumns, defaults);
  }, [
    columnViewGroups,
    columnDefinitions,
    resolvedDefaultVisibleColumns,
    state.visibleColumns,
  ]);

  const handleResetViewLayout = React.useCallback(() => {
    if (columnViewGroups.length > 0) {
      columnViewGroups.forEach((group) => {
        if (
          !canResolveDefaultVisibleColumns(
            group.columnDefinitions,
            group.defaultVisibleColumns,
          )
        ) {
          return;
        }
        group.onVisibleColumnsChange(
          ensureAtLeastOneVisibleColumn(
            resolveDefaultVisibleColumns(
              group.columnDefinitions,
              group.defaultVisibleColumns,
            ),
            group.columnDefinitions.map((column) => column.key),
          ),
        );
      });
      return;
    }
    if (
      !canResolveDefaultVisibleColumns(
        columnDefinitions,
        resolvedDefaultVisibleColumns,
      )
    ) {
      return;
    }
    handleVisibleColumnsChange(
      resolveDefaultVisibleColumns(
        columnDefinitions,
        resolvedDefaultVisibleColumns,
      ),
    );
  }, [
    columnViewGroups,
    columnDefinitions,
    resolvedDefaultVisibleColumns,
    handleVisibleColumnsChange,
  ]);

  const searchFromControl = searchFromEnabled ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-7 shrink-0 rounded-full text-xs",
            compact ? "size-7 px-0" : "px-2",
            controlClassName,
          )}
          aria-label={`Search from ${searchFromSummary}`}
        >
          <Search
            className={cn("h-3.5 w-3.5 opacity-70", !compact && "sm:mr-1")}
          />
          <span
            className={cn(
              "max-w-[9rem] truncate",
              compact ? "sr-only" : "hidden sm:inline",
            )}
          >
            {searchFromSummary}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel>Search from</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {searchFromViewGroupsResolved
          .flatMap((group) => group.options)
          .map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={activeSearchFromValues.includes(option.value)}
              onCheckedChange={() => toggleSearchFromValue(option.value)}
              onSelect={(event) => event.preventDefault()}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;
  const defaultSearchLeadingAccessory = (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Search className="h-3.5 w-3.5" />
    </span>
  );
  const searchLeadingContent =
    searchLeadingAccessory ??
    searchFromControl ??
    defaultSearchLeadingAccessory;

  const currentSettings: DisplaySettings = {
    ...(view?.value ? { layout: view.value } : {}),
    filters: filterStateAdapter?.write(state.filters) ?? state.filters,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    groupBy: state.groupBy,
    visibleColumns: state.visibleColumns,
    ...(columnViewGroups.length
      ? {
          columnGroups: Object.fromEntries(
            columnViewGroups.map((group) => [
              group.heading,
              group.visibleColumns,
            ]),
          ),
        }
      : {}),
    ...(conditionFilters ? { conditions: conditionFilters.value } : {}),
  };
  const defaultsRef = React.useRef<DisplaySettings>({
    ...currentSettings,
    filters: {},
    visibleColumns:
      resolvedDefaultVisibleColumns ?? currentSettings.visibleColumns,
    ...(conditionFilters ? { conditions: [] } : {}),
  });
  const matchingView = useMatchingView(
    quickFilters,
    currentSettings,
    defaultsRef.current,
  );
  const applySavedView = (saved: SavedView) => {
    const settings = readViewSettings(saved.config, defaultsRef.current);
    onQuickFilterApply({ ...saved, config: encodeViewConfig(settings) });
    conditionFilters?.onChange(settings.conditions ?? []);
    for (const group of columnViewGroups) {
      const columns = settings.columnGroups?.[group.heading];
      if (columns) group.onVisibleColumnsChange(columns);
    }
    view?.onPresetApply?.(settings);
  };
  const displayContent = (
    <>
      {view ? (
        <div className="flex gap-2 px-4 py-3" aria-label="View layout">
          {view.options.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="field"
              className={cn(
                "h-8 flex-1 rounded-full",
                toolbarControlStyles,
                view.value === option.value
                  ? toolbarControlSelectedStyles
                  : toolbarControlUnselectedStyles,
              )}
              aria-pressed={view.value === option.value}
              onClick={() => view.onChange(option.value)}
            >
              {option.value === "board" ? (
                <LayoutGrid className="mr-2 h-4 w-4" />
              ) : (
                <List className="mr-2 h-4 w-4" />
              )}
              {option.label}
            </Button>
          ))}
        </div>
      ) : null}
      {groupByOptions.length || sortOptions.length || viewContent ? (
        <div className="px-4 py-3">
          {groupByOptions.length ? (
            <ToolbarSelectRow
              label="Group by"
              summary={
                groupByOptions.find((option) => option.key === state.groupBy)
                  ?.label ?? "No grouping"
              }
              persistenceKey={`${filterPersistenceKey}:group`}
            >
              <SearchableSelectInline
                items={groupByOptions}
                value={
                  groupByOptions.find(
                    (option) => option.key === state.groupBy,
                  ) ?? null
                }
                onValueChange={(option) => onGroupByChange(option?.key ?? null)}
                getItemId={(option) => option.key}
                getItemLabel={(option) => option.label}
                searchPlaceholder="Search groups..."
                allowClear={!groupByRequired}
                clearLabel="No grouping"
              />
            </ToolbarSelectRow>
          ) : null}
          {sortOptions.length ? (
            <>
              <ToolbarSelectRow
                label="Sort"
                summary={
                  sortOptions.find((option) => option.key === state.sortBy)
                    ?.label ?? "None"
                }
                persistenceKey={`${filterPersistenceKey}:sort`}
                accessory={
                  state.sortBy ? (
                    <button
                      type="button"
                      aria-label={
                        state.sortDirection === "asc"
                          ? "Sort descending"
                          : "Sort ascending"
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() =>
                        onSortChange(
                          state.sortBy,
                          state.sortDirection === "asc" ? "desc" : "asc",
                        )
                      }
                    >
                      {state.sortDirection === "asc" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                    </button>
                  ) : null
                }
              >
                <SearchableSelectInline
                  items={sortOptions}
                  value={
                    sortOptions.find((option) => option.key === state.sortBy) ??
                    null
                  }
                  onValueChange={(option) =>
                    onSortChange(
                      option?.key ?? null,
                      option
                        ? option.key === state.sortBy
                          ? state.sortDirection
                          : "asc"
                        : "asc",
                    )
                  }
                  getItemId={(option) => option.key}
                  getItemLabel={(option) => option.label}
                  searchPlaceholder="Search sort options..."
                  allowClear
                  clearLabel="None"
                />
              </ToolbarSelectRow>
            </>
          ) : null}
          {viewContent}
        </div>
      ) : null}
      {filterDefinitions.length ||
      conditionFilters?.fields.length ||
      filterFooter ? (
        <div className="px-4 py-3">
          <p className="mb-2 text-sm text-muted-foreground">Filters</p>
          <ToolbarFilterPills
            {...filtersProps}
            hideClear
            trailingContent={
              <div className="inline-flex shrink-0 items-center gap-1">
                <ToolbarAddFilter {...filtersProps} />
                {effectiveActiveFilterCount ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleClearAllFilters}
                  >
                    Clear all filters
                  </Button>
                ) : null}
              </div>
            }
            showDeletedActive={showDeletedActive}
            clearDeleted={onClearShowDeleted}
          />
          {filterFooter}
        </div>
      ) : null}
      {columnViewGroups.length || columnDefinitions.length ? (
        <div className="px-4 py-3">
          <p className="mb-2 text-sm text-muted-foreground">
            Display properties
          </p>
          {(columnViewGroups.length
            ? columnViewGroups
            : [
                {
                  heading: columnHeading,
                  columnDefinitions,
                  visibleColumns: state.visibleColumns,
                  onVisibleColumnsChange: handleVisibleColumnsChange,
                },
              ]
          ).map((group) => (
            <div key={group.heading} className="space-y-2 py-1">
              {columnViewGroups.length ? (
                <p className="text-xs text-muted-foreground">{group.heading}</p>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {group.columnDefinitions.map((column) => {
                  const selected = group.visibleColumns.includes(column.key);
                  const required =
                    selected &&
                    group.visibleColumns.length === 1 &&
                    (columnViewGroups.length > 0 || !allowEmptyColumns);
                  return (
                    <button
                      key={column.key}
                      type="button"
                      aria-pressed={selected}
                      disabled={required}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                        toolbarControlStyles,
                        selected
                          ? toolbarControlSelectedStyles
                          : toolbarControlUnselectedStyles,
                      )}
                      onClick={() =>
                        group.onVisibleColumnsChange(
                          selected
                            ? group.visibleColumns.filter(
                                (key) => key !== column.key,
                              )
                            : [...group.visibleColumns, column.key],
                        )
                      }
                    >
                      {column.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {viewLayoutChangeCount ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={handleResetViewLayout}
            >
              Reset column layout to default
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
  if (displayInline) return <div className="min-w-0">{displayContent}</div>;

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2",
        compact && "gap-1.5",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          compact ? "flex-nowrap justify-center gap-1" : "flex-wrap",
          rowClassName,
        )}
      >
        {/* Search */}
        {!hideSearch ? (
          <div
            className={cn(
              "flex h-10 min-w-0 flex-1 items-center rounded-md border border-input bg-background px-2 ring-offset-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
              compact && "h-9",
              searchContainerClassName,
            )}
          >
            {searchLeadingContent}
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className={cn(
                "h-full min-w-0 flex-1 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                compact && "text-sm",
                searchInputClassName,
              )}
            />
            {searchValue && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchValue("")}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : null}
        {!hideSearch && searchAccessory}

        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(controlBtnClass(), "relative overflow-visible")}
              aria-label="Display options"
            >
              <SlidersHorizontal className={iconClass()} />
              <span className={labelClass}>Display</span>
              {!matchingView ? (
                <span
                  role="img"
                  aria-label="Custom display settings"
                  title="Custom display settings"
                  className="absolute -right-1 -top-1 inline-flex h-2.5 w-4 rounded-full border border-background bg-primary"
                />
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            aria-label="Display options"
            className="max-h-[min(80vh,700px)] w-[min(420px,calc(100vw-24px))] overflow-y-auto p-0"
          >
            {displayContent}
          </PopoverContent>
        </Popover>
      </div>
      {!hideViews ? (
        <ToolbarSavedViews
          views={quickFilters}
          target={viewTarget ?? quickFilters[0]?.target_entity}
          current={currentSettings}
          defaults={defaultsRef.current}
          onApply={applySavedView}
          renderEditor={(draft, onChange) => (
            <DataTableToolbar
              {...props}
              displayInline
              hideViews
              hideSearch
              filterFooter={undefined}
              viewContent={undefined}
              showDeletedActive={false}
              onClearShowDeleted={undefined}
              state={{
                ...state,
                ...draft,
                filters:
                  filterStateAdapter?.read(draft.filters) ?? draft.filters,
              }}
              onSearchChange={() => {}}
              onFiltersChange={(filters) =>
                onChange({
                  ...draft,
                  filters: filterStateAdapter?.write(filters) ?? filters,
                })
              }
              onSortChange={(sortBy, sortDirection) =>
                onChange({ ...draft, sortBy, sortDirection })
              }
              onGroupByChange={(groupBy) => onChange({ ...draft, groupBy })}
              onVisibleColumnsChange={(visibleColumns) =>
                onChange({ ...draft, visibleColumns })
              }
              onQuickFilterApply={() => {}}
              onReset={() => {}}
              view={
                view
                  ? {
                      ...view,
                      value: draft.layout ?? view.value,
                      onChange: (layout) => onChange({ ...draft, layout }),
                      onPresetApply: undefined,
                    }
                  : undefined
              }
              conditionFilters={
                conditionFilters
                  ? {
                      ...conditionFilters,
                      value: draft.conditions ?? [],
                      onChange: (conditions) =>
                        onChange({ ...draft, conditions }),
                    }
                  : undefined
              }
              columnViewGroups={columnViewGroups.map((group) => ({
                ...group,
                visibleColumns:
                  draft.columnGroups?.[group.heading] ?? group.visibleColumns,
                onVisibleColumnsChange: (columns) =>
                  onChange({
                    ...draft,
                    columnGroups: {
                      ...draft.columnGroups,
                      [group.heading]: columns,
                    },
                  }),
              }))}
            />
          )}
        />
      ) : null}
    </div>
  );
}
