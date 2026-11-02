'use client';

import * as React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { cn } from '../lib/cn';
import { fieldTriggerClassName } from '../lib/field-trigger';
import { parseNaturalDate } from '../lib/smart-date-parser';
import { navActiveStyles, navHoverStyles } from '../lib/styles';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export type SmartDatePickerValueFormat = 'date' | 'iso';

export interface SmartDatePickerPreset {
  label: string;
  value: Date;
}

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
  /** When false, hides caller-provided presets. Default true. */
  showPresets?: boolean;
  /** Optional shortcuts displayed below the calendar. */
  presets?: ReadonlyArray<SmartDatePickerPreset>;
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
  /** When false, hides caller-provided presets. Default true. */
  showPresets?: boolean;
  /** Optional shortcuts displayed below the calendar. */
  presets?: ReadonlyArray<SmartDatePickerPreset>;
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
  return `${date.getUTCDate()} ${PILL_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function dateToIsoDate(date: Date): string {
  const dateOnly = format(date, 'yyyy-MM-dd');
  return new Date(dateOnly).toISOString();
}

function formatDateOption(date: Date): string {
  return format(date, 'EEE, d MMM yyyy');
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
  presets: presetOptions,
  anchorYear,
  disabled = false,
  inputPlaceholder = 'Type a date...',
}: SmartDatePickerPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputValue = toDateInputValue(value);
  const [month, setMonth] = React.useState(() =>
    startOfMonth(inputValue ? parseISO(inputValue) : new Date()),
  );
  const today = React.useMemo(() => startOfDay(new Date()), [open]);

  const presets = showPresets ? presetOptions ?? [] : [];
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const todayValue = format(today, 'yyyy-MM-dd');

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
    onBlur?.();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled && nextOpen) return;
    setOpen(nextOpen);
    if (nextOpen) setMonth(startOfMonth(inputValue ? parseISO(inputValue) : new Date()));
    if (!nextOpen) {
      setQuery('');
      onBlur?.();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={modal}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[20rem] max-w-[calc(100vw-2rem)] p-0"
        collisionPadding={16}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        align={align}
        onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
        onKeyDown={stopPropagation ? (event) => event.stopPropagation() : undefined}
      >
        {name ? <input type="hidden" name={name} value={inputValue} /> : null}
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            aria-label="Type a date"
            className="h-11 min-w-0 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={inputPlaceholder}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                if (parsedQueryDate) selectDate(parsedQueryDate);
              }
            }}
          />
        </div>
        <div className="max-h-[min(32rem,65vh)] overflow-y-auto overscroll-contain p-3">
          {query.trim() ? (
            parsedQueryDate ? (
              <button
                type="button"
                disabled={!isDateAllowed(parsedQueryDate, minDate, maxDate)}
                onClick={() => selectDate(parsedQueryDate)}
                className="mb-2 w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                Use {formatDateOption(parsedQueryDate)}
              </button>
            ) : (
              <p role="status" className="mb-2 px-2 py-2 text-sm text-muted-foreground">No date found</p>
            )
          ) : null}
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Previous month"
              onClick={() => setMonth((previous) => addMonths(previous, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium" aria-live="polite">{format(month, 'MMMM yyyy')}</div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Next month"
              onClick={() => setMonth((previous) => addMonths(previous, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-1" aria-hidden="true">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="text-center text-xs text-muted-foreground">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" role="group" aria-label={format(month, 'MMMM yyyy')}>
            {days.map((day) => {
              const date = format(day, 'yyyy-MM-dd');
              if (!isSameMonth(day, month)) return <div key={date} aria-hidden="true" className="aspect-square" />;
              return (
                <button
                  key={date}
                  type="button"
                  aria-label={format(day, 'EEEE, d MMMM yyyy')}
                  aria-pressed={date === inputValue}
                  aria-current={date === todayValue ? 'date' : undefined}
                  disabled={!isDateAllowed(day, minDate, maxDate)}
                  onClick={() => selectDate(day)}
                  className={cn(
                    'aspect-square min-w-0 rounded-md border border-transparent text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
                    date === inputValue ? navActiveStyles : navHoverStyles,
                    date === todayValue && 'font-semibold ring-1 ring-border',
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
          {presets.length > 0 ? (
            <div className="mt-3 border-t pt-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  disabled={!isDateAllowed(preset.value, minDate, maxDate)}
                  onClick={() => selectDate(preset.value)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent disabled:opacity-50"
                >
                  <span>{preset.label}</span>
                  <span className="text-xs text-muted-foreground">{formatDateOption(preset.value)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="border-t p-1">
          <button
            type="button"
            onClick={() => selectDate(null)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear date
          </button>
        </div>
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
        data-button-variant="outline"
        data-overdue={overdue || undefined}
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
  presets,
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
      presets={presets}
      anchorYear={anchorYear}
      disabled={disabled}
      inputPlaceholder={inputPlaceholder}
    >
      <button
        type="button"
        disabled={disabled}
        className={cn(
          fieldTriggerClassName,
          'group justify-between',
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
