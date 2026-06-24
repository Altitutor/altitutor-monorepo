'use client';

import { Search } from 'lucide-react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { cn } from '../lib/cn';

export interface SearchFromOption {
  label: string;
  value: string;
}

export interface SearchFromDropdownProps {
  options: SearchFromOption[];
  value?: string[];
  onValueChange?: (values: string[]) => void;
  menuLabel?: string;
  allSelectedLabel?: string;
  /** Suffix for partial selection summary, e.g. "fields" → "3 fields" */
  partialSelectedSuffix?: string;
  className?: string;
  buttonClassName?: string;
  menuContentClassName?: string;
  compact?: boolean;
  /** Set false when used inside dialogs/modals to avoid focus-trap conflicts */
  modal?: boolean;
}

export function SearchFromDropdown({
  options,
  value,
  onValueChange,
  menuLabel = 'Search from',
  allSelectedLabel = 'All',
  partialSelectedSuffix = 'selected',
  className,
  buttonClassName,
  menuContentClassName,
  compact = false,
  modal = true,
}: SearchFromDropdownProps) {
  const activeValues = value ?? options.map((option) => option.value);
  const enabled = options.length > 1 && !!onValueChange;

  const summary = (() => {
    if (activeValues.length === options.length) return allSelectedLabel;
    if (activeValues.length === 1) {
      return options.find((option) => option.value === activeValues[0])?.label ?? menuLabel;
    }
    return `${activeValues.length} ${partialSelectedSuffix}`;
  })();

  const toggleValue = (optionValue: string) => {
    if (!onValueChange) return;

    if (activeValues.length === options.length) {
      onValueChange([optionValue]);
      return;
    }

    const next = activeValues.includes(optionValue)
      ? activeValues.length === 1
        ? options.map((option) => option.value)
        : activeValues.filter((item) => item !== optionValue)
      : [...activeValues, optionValue];
    onValueChange(next);
  };

  if (!enabled) {
    return (
      <span
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground',
          className,
        )}
      >
        <Search className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <DropdownMenu modal={modal}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-7 shrink-0 rounded-full text-xs',
            compact ? 'size-7 px-0' : 'px-2',
            buttonClassName,
            className,
          )}
          aria-label={`${menuLabel} ${summary}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Search className={cn('h-3.5 w-3.5 opacity-70', !compact && 'sm:mr-1')} />
          <span
            className={cn(
              'max-w-[9rem] truncate',
              compact ? 'sr-only' : 'hidden sm:inline',
            )}
          >
            {summary}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn('w-[220px]', menuContentClassName)}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={activeValues.includes(option.value)}
            onCheckedChange={() => toggleValue(option.value)}
            onSelect={(event) => event.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
