'use client';

import * as React from 'react';
import { Calendar } from 'lucide-react';
import { addDays, format, startOfDay } from 'date-fns';
import { cn } from '../lib/cn';
import { parseNaturalDate } from '../lib/smart-date-parser';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export type SmartDatePickerValueFormat = 'date' | 'iso';

export interface SmartDatePickerPopoverProps {
  children: React.ReactElement;
  value: string | null;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  name?: string;
  modal?: boolean;
  align?: 'start' | 'center' | 'end';
  stopPropagation?: boolean;
  minDate?: string | null;
  maxDate?: string | null;
  /** When false, hides Today / Tomorrow / This weekend / Next week presets. Default true. */
  showPresets?: boolean;
  /** Force typed month/day into this calendar year. */
  anchorYear?: number;
  disabled?: boolean;
  /** Placeholder for the popover type-to-search input. */
  inputPlaceholder?: string;
}

export interface SmartDatePickerPillProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  valueFormat?: SmartDatePickerValueFormat;
  icon?: React.ReactNode;
  emptyLabel?: string;
  overdue?: boolean;
  emptyOpacity?: boolean;
  className?: string;
  modal?: boolean;
  stopPropagation?: boolean;
}

export interface SmartDatePickerFieldProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  name?: string;
  valueFormat?: SmartDatePickerValueFormat;
  placeholder?: string;
  className?: string;
  modal?: boolean;
  align?: 'start' | 'center' | 'end';
  stopPropagation?: boolean;
  minDate?: string | null;
  maxDate?: string | null;
  /** When false, hides Today / Tomorrow / This weekend / Next week presets. Default true. */
  showPresets?: boolean;
  /** Force typed month/day into this calendar year. */
  anchorYear?: number;
  disabled?: boolean;
  /** Placeholder for the popover type-to-search input. */
  inputPlaceholder?: string;
}

const PILL_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function formatPillDisplayDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return `${date.getUTCDate()} ${PILL_MONTHS[date.getUTCMonth()]}`;
}

function dateToIsoDate(date: Date): string {
  const dateOnly = format(date, 'yyyy-MM-dd');
  return new Date(dateOnly).toISOString();
}

function nextWeekday(from: Date, weekday: number): Date {
  const daysUntil = (weekday - from.getDay() + 7) % 7 || 7;
  return addDays(from, daysUntil);
}

function getThisWeekend(from: Date): Date {
  const day = from.getDay();
  if (day === 0 || day === 6) return from;
  return addDays(from, 6 - day);
}

function formatDateOption(date: Date): string {
  return format(date, 'EEE, MMM d');
}

function isDateAllowed(date: Date, minDate?: string | null, maxDate?: string | null): boolean {
  const dateValue = format(date, 'yyyy-MM-dd');
  if (minDate && dateValue < minDate) return false;
  if (maxDate && dateValue > maxDate) return false;
  return true;
}

export function SmartDatePickerPopover({
  children,
  value,
  onChange,
  onBlur,
  name,
  modal = false,
  align = 'start',
  stopPropagation = false,
  minDate,
  maxDate,
  showPresets = true,
  anchorYear,
  disabled = false,
  inputPlaceholder = 'Type a date...',
}: SmartDatePickerPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const inputValue = toDateInputValue(value);
  const today = React.useMemo(() => startOfDay(new Date()), [open]);

  const presets = React.useMemo(() => {
    if (!showPresets) return [];
    return [
      { label: 'Today', value: today },
      { label: 'Tomorrow', value: addDays(today, 1) },
      { label: 'This weekend', value: getThisWeekend(today) },
      { label: 'Next week', value: nextWeekday(today, 1) },
    ];
  }, [showPresets, today]);

  const parsedQueryDate = React.useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    return parseNaturalDate(trimmed, today, {
      anchorYear,
    });
  }, [anchorYear, query, today]);

  const selectDate = (date: Date | null) => {
    if (date && !isDateAllowed(date, minDate, maxDate)) return;
    onChange(date ? dateToIsoDate(date) : null);
    setQuery('');
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled && nextOpen) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery('');
      onBlur?.();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={modal}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[20rem] p-0"
        align={align}
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
        onKeyDown={stopPropagation ? (event) => event.stopPropagation() : undefined}
      >
        {name ? <input type="hidden" name={name} value={inputValue} /> : null}
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={inputPlaceholder}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && parsedQueryDate) {
                event.preventDefault();
                event.stopPropagation();
                selectDate(parsedQueryDate);
              }
            }}
          />
          <CommandList>
            {parsedQueryDate ? (
              <CommandGroup heading="Typed date">
                <CommandItem
                  value={`custom-${query}`}
                  disabled={!isDateAllowed(parsedQueryDate, minDate, maxDate)}
                  onSelect={() => selectDate(parsedQueryDate)}
                  className="gap-2"
                >
                  <span className="font-medium">Use "{query.trim()}"</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateOption(parsedQueryDate)}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : query.trim() ? (
              <CommandEmpty>No date found</CommandEmpty>
            ) : null}

            {presets.length > 0 ? (
              <CommandGroup heading="Presets">
                {presets.map((preset) => (
                  <CommandItem
                    key={preset.label}
                    value={`${preset.label} ${formatDateOption(preset.value)}`}
                    disabled={!isDateAllowed(preset.value, minDate, maxDate)}
                    onSelect={() => selectDate(preset.value)}
                    className="gap-2"
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateOption(preset.value)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            <CommandGroup>
              <CommandItem value="clear no date" onSelect={() => selectDate(null)}>
                Clear date
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SmartDatePickerPill({
  value,
  onChange,
  onBlur,
  valueFormat = 'date',
  icon,
  emptyLabel = 'Date',
  overdue = false,
  emptyOpacity = true,
  className,
  modal = false,
  stopPropagation = true,
}: SmartDatePickerPillProps) {
  const formattedDate = formatPillDisplayDate(value);

  const handleChange = (isoValue: string | null) => {
    if (!isoValue) {
      onChange(null);
      return;
    }
    onChange(valueFormat === 'iso' ? isoValue : isoValue.split('T')[0]);
  };

  return (
    <SmartDatePickerPopover
      value={value ?? null}
      onChange={handleChange}
      onBlur={onBlur}
      modal={modal}
      stopPropagation={stopPropagation}
    >
      <button
        type="button"
        className={cn(
          'relative inline-flex h-8 items-center gap-1.5 rounded-full border bg-background cursor-pointer select-none transition-colors hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70 dark:hover:text-white group',
          'px-3 text-xs w-auto',
          !formattedDate && 'text-muted-foreground',
          overdue && 'border-red-500',
          className
        )}
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
        onPointerDown={stopPropagation ? (event) => event.stopPropagation() : undefined}
        onKeyDown={
          stopPropagation
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.stopPropagation();
                }
              }
            : undefined
        }
      >
        {icon ?? (
          <Calendar
            className={cn(
              'h-3 w-3 flex-shrink-0 pointer-events-none',
              overdue
                ? 'text-red-500'
                : formattedDate
                  ? 'text-foreground'
                  : 'text-muted-foreground',
              !formattedDate && emptyOpacity && 'opacity-40 group-hover:opacity-100'
            )}
          />
        )}
        <span
          className={cn(
            'truncate whitespace-nowrap pointer-events-none',
            !formattedDate && 'text-muted-foreground',
            !formattedDate && emptyOpacity && 'opacity-40 group-hover:opacity-100',
            overdue && formattedDate && 'text-red-700 dark:text-red-400'
          )}
        >
          {formattedDate ?? emptyLabel}
        </span>
      </button>
    </SmartDatePickerPopover>
  );
}

export function SmartDatePickerField({
  value,
  onChange,
  onBlur,
  name,
  valueFormat = 'date',
  placeholder = 'Select date',
  className,
  modal = false,
  align = 'start',
  stopPropagation = false,
  minDate,
  maxDate,
  showPresets = true,
  anchorYear,
  disabled = false,
  inputPlaceholder,
}: SmartDatePickerFieldProps) {
  const formattedDate = value ? formatPillDisplayDate(value) : null;

  const handleChange = (isoValue: string | null) => {
    if (!isoValue) {
      onChange(null);
      return;
    }
    onChange(valueFormat === 'iso' ? isoValue : isoValue.split('T')[0]);
  };

  return (
    <SmartDatePickerPopover
      value={value ?? null}
      onChange={handleChange}
      onBlur={onBlur}
      name={name}
      modal={modal}
      align={align}
      stopPropagation={stopPropagation}
      minDate={minDate}
      maxDate={maxDate}
      showPresets={showPresets}
      anchorYear={anchorYear}
      disabled={disabled}
      inputPlaceholder={inputPlaceholder}
    >
      <button
        type="button"
        disabled={disabled}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 group',
          !formattedDate && 'text-muted-foreground',
          className
        )}
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
        onPointerDown={stopPropagation ? (event) => event.stopPropagation() : undefined}
        onKeyDown={
          stopPropagation
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.stopPropagation();
                }
              }
            : undefined
        }
      >
        <span className="truncate">{formattedDate ?? placeholder}</span>
        <Calendar className={cn('h-4 w-4 shrink-0', formattedDate ? 'text-foreground' : 'text-muted-foreground opacity-40 group-hover:opacity-100')} />
      </button>
    </SmartDatePickerPopover>
  );
}
