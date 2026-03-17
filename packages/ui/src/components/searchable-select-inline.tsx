"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { cn } from "../lib/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";

export interface SearchableSelectInlinePropsBase<T> {
  /** Items to display in the list */
  items: T[];
  /** Get display label for an item */
  getItemLabel: (item: T) => string;
  /** Get unique id for an item (for comparison) */
  getItemId: (item: T) => string;
  /** Get search/filter value for an item. Defaults to getItemLabel */
  getItemValue?: (item: T) => string;
  /** Placeholder for the search input */
  searchPlaceholder?: string;
  /** Message when no items match */
  emptyMessage?: string;
  /** Show loading state */
  loading?: boolean;
  /** For server-side search: parent controls items, we pass search to parent */
  onSearchChange?: (query: string) => void;
  /** Custom render for each item */
  renderItem?: (item: T, isSelected: boolean) => React.ReactNode;
  /** Additional class names */
  className?: string;
}

export interface SearchableSelectInlinePropsSingle<T> extends SearchableSelectInlinePropsBase<T> {
  multiSelect?: false;
  /** Currently selected item (null for none) */
  value: T | null;
  /** Called when selection changes */
  onValueChange: (value: T | null) => void;
  /** Show "None" / clear option for nullable selection */
  allowClear?: boolean;
  /** Label for the clear option when allowClear is true (default: "None") */
  clearLabel?: string;
}

export interface SearchableSelectInlinePropsMulti<T> extends SearchableSelectInlinePropsBase<T> {
  multiSelect: true;
  /** Currently selected items */
  value: T[];
  /** Called when selection changes */
  onValueChange: (value: T[]) => void;
  /** allowClear is ignored in multi-select mode */
  allowClear?: never;
  clearLabel?: never;
}

export type SearchableSelectInlineProps<T> =
  | SearchableSelectInlinePropsSingle<T>
  | SearchableSelectInlinePropsMulti<T>;

/**
 * Inline searchable select - renders Command + CommandInput + CommandList
 * without a Popover. Use inside DropdownMenuSubContent or similar containers.
 */
export function SearchableSelectInline<T>({
  items,
  value,
  onValueChange,
  getItemLabel,
  getItemId,
  getItemValue,
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  loading = false,
  allowClear = false,
  clearLabel = "None",
  onSearchChange,
  renderItem,
  className,
  multiSelect = false,
}: SearchableSelectInlineProps<T>) {
  const [search, setSearch] = React.useState("");
  const [highlightedValue, setHighlightedValue] = React.useState<string | undefined>(undefined);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isServerSideSearch = Boolean(onSearchChange);
  const getValue = getItemValue ?? getItemLabel;

  // When using server-side search, auto-highlight first item when results change
  const firstSelectableValue = React.useMemo(() => {
    if (!isServerSideSearch || loading) return undefined;
    if (!multiSelect && allowClear) return "__clear__";
    const firstItem = items[0];
    if (!firstItem) return undefined;
    return `${getItemId(firstItem)}-${getValue(firstItem)}`;
  }, [isServerSideSearch, loading, multiSelect, allowClear, items, getItemId, getValue]);

  React.useEffect(() => {
    if (isServerSideSearch && firstSelectableValue !== undefined) {
      setHighlightedValue(firstSelectableValue);
    } else if (!loading) {
      setHighlightedValue(undefined);
    }
  }, [isServerSideSearch, firstSelectableValue, loading]);

  React.useEffect(() => {
    // Focus the search input when the component mounts (e.g. when dropdown opens)
    const input = inputRef.current;
    if (input) {
      requestAnimationFrame(() => input.focus());
    }
  }, []);

  const selectedIds = React.useMemo(() => {
    if (multiSelect && Array.isArray(value)) {
      return new Set((value as T[]).map((v: T) => getItemId(v)));
    }
    if (!multiSelect && value != null) {
      return new Set([getItemId(value as T)]);
    }
    return new Set<string>();
  }, [multiSelect, value, getItemId]);

  const handleSearchChange = React.useCallback(
    (query: string) => {
      setSearch(query);
      onSearchChange?.(query);
    },
    [onSearchChange]
  );

  const handleSelectSingle = React.useCallback(
    (item: T | null) => {
      (onValueChange as (v: T | null) => void)(item);
      setSearch("");
      onSearchChange?.("");
    },
    [onValueChange, onSearchChange]
  );

  const handleSelectMulti = React.useCallback(
    (item: T) => {
      const current = value as T[];
      const id = getItemId(item);
      const isSelected = selectedIds.has(id);
      const next = isSelected
        ? current.filter((v) => getItemId(v) !== id)
        : [...current, item];
      (onValueChange as (v: T[]) => void)(next);
    },
    [value, onValueChange, getItemId, selectedIds]
  );

  return (
    <Command
      shouldFilter={!isServerSideSearch}
      disablePointerSelection={false}
      value={isServerSideSearch ? highlightedValue ?? "" : undefined}
      onValueChange={isServerSideSearch ? setHighlightedValue : undefined}
      className={cn("rounded-lg border-0", className)}
    >
      <CommandInput
        ref={inputRef}
        placeholder={searchPlaceholder}
        value={isServerSideSearch ? search : undefined}
        onValueChange={isServerSideSearch ? handleSearchChange : undefined}
      />
      <CommandList>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Searching...</span>
          </div>
        ) : (
          <>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {!multiSelect && allowClear && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => handleSelectSingle(null)}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      value ? "opacity-0" : "opacity-100"
                    )}
                  />
                  <span className={!value ? "font-medium" : ""}>{clearLabel}</span>
                </CommandItem>
              )}
              {items.map((item) => {
                const id = getItemId(item);
                const isSelected = selectedIds.has(id);
                const itemValue = `${id}-${getValue(item)}`;

                return (
                  <CommandItem
                    key={id}
                    value={itemValue}
                    onSelect={() =>
                      multiSelect ? handleSelectMulti(item) : handleSelectSingle(item)
                    }
                    className="flex items-center gap-2"
                  >
                    {renderItem ? (
                      renderItem(item, isSelected)
                    ) : (
                      <>
                        <Check
                          className={cn(
                            "h-4 w-4 flex-shrink-0",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className={isSelected ? "font-medium" : ""}>
                          {getItemLabel(item)}
                        </span>
                      </>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
}
