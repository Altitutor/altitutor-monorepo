'use client';

import { Input } from '@altitutor/ui';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { parseISO, format, addDays, subDays, isValid, isAfter } from 'date-fns';
import { cn } from '@/shared/utils';

interface DateRangePickerProps {
  from: string; // YYYY-MM-DD or empty string
  to: string; // YYYY-MM-DD or empty string
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  className?: string;
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  fromPlaceholder = 'From date',
  toPlaceholder = 'To date',
  className,
}: DateRangePickerProps) {
  // Ensure from <= to
  const ensureValidRange = (newFrom: string, newTo: string) => {
    if (!newFrom || !newTo) return { from: newFrom, to: newTo };
    
    try {
      const fromDate = parseISO(newFrom);
      const toDate = parseISO(newTo);
      
      if (!isValid(fromDate) || !isValid(toDate)) {
        return { from: newFrom, to: newTo };
      }
      
      // If from > to, adjust both dates
      if (isAfter(fromDate, toDate)) {
        return { from: newTo, to: newFrom };
      }
      
      return { from: newFrom, to: newTo };
    } catch {
      return { from: newFrom, to: newTo };
    }
  };

  const handleFromIncrement = () => {
    if (!from) return;
    try {
      const date = parseISO(from);
      if (!isValid(date)) return;
      const newDate = addDays(date, 1);
      const newFrom = format(newDate, 'yyyy-MM-dd');
      
      // If from === to, increment both dates together
      if (from === to && to) {
        onFromChange(newFrom);
        onToChange(newFrom);
        return;
      }
      
      const { from: adjustedFrom, to: adjustedTo } = ensureValidRange(newFrom, to);
      onFromChange(adjustedFrom);
      if (adjustedTo !== to) {
        onToChange(adjustedTo);
      }
    } catch {
      // Invalid date, ignore
    }
  };

  const handleFromDecrement = () => {
    if (!from) return;
    try {
      const date = parseISO(from);
      if (!isValid(date)) return;
      const newDate = subDays(date, 1);
      const newFrom = format(newDate, 'yyyy-MM-dd');
      const { from: adjustedFrom, to: adjustedTo } = ensureValidRange(newFrom, to);
      onFromChange(adjustedFrom);
      if (adjustedTo !== to) {
        onToChange(adjustedTo);
      }
    } catch {
      // Invalid date, ignore
    }
  };

  const handleToIncrement = () => {
    if (!to) return;
    try {
      const date = parseISO(to);
      if (!isValid(date)) return;
      const newDate = addDays(date, 1);
      const newTo = format(newDate, 'yyyy-MM-dd');
      const { from: adjustedFrom, to: adjustedTo } = ensureValidRange(from, newTo);
      onToChange(adjustedTo);
      if (adjustedFrom !== from) {
        onFromChange(adjustedFrom);
      }
    } catch {
      // Invalid date, ignore
    }
  };

  const handleToDecrement = () => {
    if (!to) return;
    try {
      const date = parseISO(to);
      if (!isValid(date)) return;
      const newDate = subDays(date, 1);
      const newTo = format(newDate, 'yyyy-MM-dd');
      
      // If from === to, decrement both dates together
      if (from === to && from) {
        onFromChange(newTo);
        onToChange(newTo);
        return;
      }
      
      const { from: adjustedFrom, to: adjustedTo } = ensureValidRange(from, newTo);
      onToChange(adjustedTo);
      if (adjustedFrom !== from) {
        onFromChange(adjustedFrom);
      }
    } catch {
      // Invalid date, ignore
    }
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrom = e.target.value;
    if (!newFrom) {
      onFromChange('');
      return;
    }
    const { from: adjustedFrom, to: adjustedTo } = ensureValidRange(newFrom, to);
    onFromChange(adjustedFrom);
    if (adjustedTo !== to) {
      onToChange(adjustedTo);
    }
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTo = e.target.value;
    if (!newTo) {
      onToChange('');
      return;
    }
    const { from: adjustedFrom, to: adjustedTo } = ensureValidRange(from, newTo);
    onToChange(adjustedTo);
    if (adjustedFrom !== from) {
      onFromChange(adjustedFrom);
    }
  };

  const handleFromClear = () => {
    onFromChange('');
  };

  const handleToClear = () => {
    onToChange('');
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* From Date */}
      <div className="relative w-auto min-w-[140px]">
        <Input
          type="date"
          value={from}
          onChange={handleFromChange}
          placeholder={fromPlaceholder}
          className="pr-16 pl-8 text-center [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full cursor-pointer"
        />
        <button
          type="button"
          onClick={handleFromDecrement}
          className="absolute left-1 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          aria-label="Decrement date"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        {from && (
          <button
            type="button"
            onClick={handleFromClear}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
            aria-label="Clear date"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <button
          type="button"
          onClick={handleFromIncrement}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          aria-label="Increment date"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* To Date */}
      <div className="relative w-auto min-w-[140px]">
        <Input
          type="date"
          value={to}
          onChange={handleToChange}
          placeholder={toPlaceholder}
          className="pr-16 pl-8 text-center [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full cursor-pointer"
        />
        <button
          type="button"
          onClick={handleToDecrement}
          className="absolute left-1 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          aria-label="Decrement date"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        {to && (
          <button
            type="button"
            onClick={handleToClear}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
            aria-label="Clear date"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <button
          type="button"
          onClick={handleToIncrement}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          aria-label="Increment date"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
