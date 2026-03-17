"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { cn } from "../lib/cn";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface SearchableSelectGroup<T> {
  label: string;
  items: T[];
}

export interface SearchableSelectProps<T> {
  /** Items to display in the list (ignored when groups is provided) */
  items: T[];
  /** Grouped items - when provided, renders multiple CommandGroups with headings */
  groups?: SearchableSelectGroup<T>[];
  /** Currently selected item (null for none) */
  value: T | null;
  /** Called when selection changes */
  onValueChange: (value: T | null) => void;
  /** Get display label for an item */
  getItemLabel: (item: T) => string;
  /** Get unique id for an item (for comparison) */
  getItemId: (item: T) => string;
  /** Get search/filter value for an item. Defaults to getItemLabel */
  getItemValue?: (item: T) => string;
  /** Placeholder when no item selected */
  placeholder?: string;
  /** Placeholder for the search input */
  searchPlaceholder?: string;
  /** Message when no items match */
  emptyMessage?: string;
  /** Custom trigger element */
  trigger?: React.ReactNode;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Show loading state */
  loading?: boolean;
  /** Show "None" / clear option for nullable selection */
  allowClear?: boolean;
  /** Label for the clear option when allowClear is true (default: "None") */
  clearLabel?: string;
  /** Optional footer (e.g. "Add to X" button) */
  footer?: React.ReactNode;
  /** Popover alignment */
  align?: "start" | "center" | "end";
  /** Popover side */
  side?: "top" | "bottom" | "left" | "right";
  /** Popover content width */
  contentWidth?: string;
  /** For server-side search: parent controls items, we pass search to parent */
  onSearchChange?: (query: string) => void;
  /** Custom render for each item */
  renderItem?: (item: T, isSelected: boolean) => React.ReactNode;
  /** Additional class names */
  className?: string;
  triggerClassName?: string;
  /** Controlled open state - when provided, parent controls when popover is open */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * A searchable dropdown/combobox using the Command (cmdk) pattern.
 * Matches the UI of the tutor-web "Add to sets" dropdown.
 *
 * Supports both client-side filtering (default) and server-side search
 * via onSearchChange. When onSearchChange is provided, filtering is
 * disabled and the parent controls the items list.
 */
export function SearchableSelect<T>({
  items,
  groups,
  value,
  onValueChange,
  getItemLabel,
  getItemId,
  getItemValue,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  trigger,
  disabled = false,
  loading = false,
  allowClear = false,
  clearLabel = "None",
  footer,
  align = "start",
  side = "bottom",
  contentWidth,
  onSearchChange,
  renderItem,
  className,
  triggerClassName,
  open: controlledOpen,
  onOpenChange,
}: SearchableSelectProps<T>) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const open = controlledOpen ?? internalOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (onOpenChange) {
        onOpenChange(next);
      } else {
        setInternalOpen(next);
      }
    },
    [onOpenChange]
  );

  const isServerSideSearch = Boolean(onSearchChange);
  const getValue = getItemValue ?? getItemLabel;

  const handleSearchChange = React.useCallback(
    (query: string) => {
      setSearch(query);
      onSearchChange?.(query);
    },
    [onSearchChange]
  );

  const handleSelect = React.useCallback(
    (item: T | null) => {
      onValueChange(item);
      setOpen(false);
      setSearch("");
      onSearchChange?.("");
    },
    [onValueChange, onSearchChange, setOpen]
  );

  React.useEffect(() => {
    if (!open) {
      setSearch("");
      onSearchChange?.("");
    } else if (isServerSideSearch) {
      onSearchChange?.("");
    }
  }, [open, isServerSideSearch, onSearchChange]);

  const displayValue = value ? getItemLabel(value) : placeholder;

  const defaultTrigger = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      disabled={disabled}
      className={cn("w-full justify-between font-normal", triggerClassName)}
    >
      <span className={cn(!value && "text-muted-foreground")}>{displayValue}</span>
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? defaultTrigger}
      </PopoverTrigger>
      <PopoverContent
        className={cn(!contentWidth && "w-[280px]", "p-0 z-[100]", className)}
        align={align}
        side={side}
        style={contentWidth ? { width: contentWidth } : undefined}
      >
        <Command
          shouldFilter={!isServerSideSearch}
          disablePointerSelection={false}
          className="rounded-lg border-0"
        >
          <CommandInput
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
                {groups ? (
                  <>
                    {allowClear && (
                      <CommandGroup>
                        <CommandItem
                          value="__clear__"
                          onSelect={() => handleSelect(null)}
                          className="flex items-center gap-2"
                        >
                          <Check className={cn("h-4 w-4 flex-shrink-0", value ? "opacity-0" : "opacity-100")} />
                          <span className={!value ? "font-medium" : ""}>{clearLabel}</span>
                        </CommandItem>
                      </CommandGroup>
                    )}
                    {groups.map((group) => (
                    <CommandGroup key={group.label} heading={group.label}>
                      {group.items.map((item) => {
                        const id = getItemId(item);
                        const isSelected = value ? getItemId(value) === id : false;
                        const itemValue = `${id}-${getValue(item)}`;

                        return (
                          <CommandItem
                            key={id}
                            value={itemValue}
                            onSelect={() => handleSelect(item)}
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
                  ))}
                  </>
                ) : (
                  <CommandGroup>
                    {allowClear && (
                      <CommandItem
                        value="__clear__"
                        onSelect={() => handleSelect(null)}
                        className="flex items-center gap-2"
                      >
                        <Check className={cn("h-4 w-4 flex-shrink-0", value ? "opacity-0" : "opacity-100")} />
                        <span className={!value ? "font-medium" : ""}>{clearLabel}</span>
                      </CommandItem>
                    )}
                    {items.map((item) => {
                      const id = getItemId(item);
                      const isSelected = value ? getItemId(value) === id : false;
                      const itemValue = `${id}-${getValue(item)}`;

                      return (
                        <CommandItem
                          key={id}
                          value={itemValue}
                          onSelect={() => handleSelect(item)}
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
                )}
              </>
            )}
          </CommandList>
        </Command>
        {footer && <div className="border-t p-2">{footer}</div>}
      </PopoverContent>
    </Popover>
  );
}
