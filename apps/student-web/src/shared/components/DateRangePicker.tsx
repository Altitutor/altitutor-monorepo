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
  // Ensure values are always strings to prevent controlled/uncontrolled input warning
  const fromValue = from ?? '';
  const toValue = to ?? '';

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
    if (!fromValue) return;
    try {
      const date = parseISO(fromValue);
      if (!isValid(date)) return;
      const newDate = addDays(date, 1);
      const newFrom = format(newDate, 'yyyy-MM-dd');
      
      // If from === to, increment both dates together
      if (fromValue === toValue && toValue) {
        onFromChange(newFrom);
        onToChange(newFrom);
        return;
      }
      
      const { from: adjustedFrom, to: adjustedTo } = ensureValidRange(newFrom, toValue);
      onFromChange(adjustedFrom);
      if (adjustedTo !== toValue) {
        onToChange(adjustedTo);
      }
    } catch {
      // Invalid date, ignore
    }
  };

  const handleFromDecrement = () => {
    if (!fromValue) return;
    try {
      const date = parseISO(fromValue);
      if (!isValid(date)) return;
      const newDate = subDays(date, 1);
      const newFrom = format(newDate, 'yyyy-MM-dd');
      const { from: adjustedFrom, to: adjustedTo } = ensureValidRange(newFrom, toValue);
      onFromChange(adjustedFrom);
      if (adjustedTo !== toValue) {
        onToChange(adjustedTo);
      }
    } catch {
      // Invalid date, ignore
    }
  };

  const handleToIncrement = () => {
    if (!toValue) return;
    try {
      const date = parseISO(toValue);
      if (!isValid(date)) return;
      const newDate = addDays(date, 1);
      const newTo = format(newDate, 'yyyy-MM-dd');
      const { from: adjustedFrom, to: adjustedTo } = ensureValidRange(fromValue, newTo);
      onToChange(adjustedTo);
      if (adjustedFrom !== fromValue) {
        onFromChange(adjustedFrom);
      }
    } catch {
      // Invalid date, ignore
    }
  };

  const handleToDecrement = () => {
    if (!toValue) return;
    try {
      const date = parseISO(toValue);
      if (!isValid(date)) return;
      const newDate = subDays(date, 1);
      const newTo = format(newDate, 'yyyy-MM-dd');
      
      // If from === to, decrement both dates together
      if (fromValue === toValue && fromValue) {
        onFromChange(newTo);
        onToChange(newTo);
        return;
      }
      
      const { from: adjustedFrom, to: adjustedTo } = ensureValidRange(fromValue, newTo);
      onToChange(adjustedTo);
      if (adjustedFrom !== fromValue) {
        onFromChange(adjustedFrom);
      }
    } catch {
      // Invalid date, ignore
    }
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrom = e.target.value;
    // Always pass through the value, even if empty or partial
    // Let the parent component handle validation
    if (!newFrom) {
      onFromChange('');
      return;
    }
    // Only validate range if both dates are complete (YYYY-MM-DD format)
    const isCompleteDate = /^\d{4}-\d{2}-\d{2}$/.test(newFrom);
    const isCompleteToDate = /^\d{4}-\d{2}-\d{2}$/.test(toValue);
    
    if (isCompleteDate && isCompleteToDate) {
      const { from: adjustedFrom, to: adjustedTo } = ensureValidRange(newFrom, toValue);
      onFromChange(adjustedFrom);
      if (adjustedTo !== toValue) {
        onToChange(adjustedTo);
      }
    } else {
      // Partial input - just pass it through without validation
      onFromChange(newFrom);
    }
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTo = e.target.value;
    // Always pass through the value, even if empty or partial
    // Let the parent component handle validation
    if (!newTo) {
      onToChange('');
      return;
    }
    // Only validate range if both dates are complete (YYYY-MM-DD format)
    const isCompleteDate = /^\d{4}-\d{2}-\d{2}$/.test(newTo);
    const isCompleteFromDate = /^\d{4}-\d{2}-\d{2}$/.test(fromValue);
    
    if (isCompleteDate && isCompleteFromDate) {
      const { from: adjustedFrom, to: adjustedTo } = ensureValidRange(fromValue, newTo);
      onToChange(adjustedTo);
      if (adjustedFrom !== fromValue) {
        onFromChange(adjustedFrom);
      }
    } else {
      // Partial input - just pass it through without validation
      onToChange(newTo);
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
          value={fromValue}
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
        {fromValue && (
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
          value={toValue}
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
        {toValue && (
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
