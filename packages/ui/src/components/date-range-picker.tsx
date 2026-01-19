'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { parseISO, format, addDays, subDays, isValid, isAfter, setDate, setMonth, setYear, getDate, getMonth, getYear } from 'date-fns';
import { cn } from '../lib/cn';

interface DateRangePickerProps {
  from: string; // YYYY-MM-DD or empty string
  to: string; // YYYY-MM-DD or empty string
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  className?: string;
}

// Get today's date in local timezone (YYYY-MM-DD format)
const getTodayLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type DatePart = 'day' | 'month' | 'year';
type DateSide = 'from' | 'to';

interface ActivePart {
  side: DateSide;
  part: DatePart;
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  className,
}: DateRangePickerProps) {
  // Ensure values are always strings to prevent controlled/uncontrolled input warning
  const fromValue = from ?? '';
  const toValue = to ?? '';
  
  // State for active date part being edited
  const [activePart, setActivePart] = useState<ActivePart | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  
  // State for partial dates (when user is typing but date is incomplete)
  const [partialDates, setPartialDates] = useState<{
    from: { day?: number; month?: number; year?: number } | null;
    to: { day?: number; month?: number; year?: number } | null;
  }>({ from: null, to: null });
  
  // Refs for hidden date inputs and debounce timer
  const fromDateInputRef = useRef<HTMLInputElement>(null);
  const toDateInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get date parts for a date string
  const getDateParts = (dateString: string): { day: number; month: number; year: number } | null => {
    if (!dateString) return null;
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return null;
      return {
        day: getDate(date),
        month: getMonth(date),
        year: getYear(date),
      };
    } catch {
      return null;
    }
  };

  // Update date part (day, month, or year) - updates UI immediately, filters only when complete or blurred
  const updateDatePart = useCallback((side: DateSide, part: DatePart, value: number) => {
    const currentDate = side === 'from' ? fromValue : toValue;
    const currentPartial = side === 'from' ? partialDates.from : partialDates.to;
    
    // Get base date for merging partial values
    let baseDate: Date;
    if (currentDate) {
      baseDate = parseISO(currentDate);
    } else {
      baseDate = parseISO(getTodayLocalDate());
    }
    
    if (!isValid(baseDate)) return;
    
    // Get base parts from current date
    const baseParts = {
      day: getDate(baseDate),
      month: getMonth(baseDate) + 1, // Convert to 1-indexed for storage
      year: getYear(baseDate),
    };
    
    // Merge partial values with current date values
    // Use partial if exists, otherwise use current date value
    const newPartial = {
      day: currentPartial?.day !== undefined ? currentPartial.day : baseParts.day,
      month: currentPartial?.month !== undefined ? currentPartial.month : baseParts.month,
      year: currentPartial?.year !== undefined ? currentPartial.year : baseParts.year,
      [part]: value, // Override the part being edited
    };
    
    // Update partial date state (this updates UI immediately)
    setPartialDates(prev => ({
      ...prev,
      [side]: newPartial,
    }));
    
    // Check if we have all three parts
    if (newPartial.day !== undefined && newPartial.month !== undefined && newPartial.year !== undefined) {
      // All parts filled - create complete date and update filters
      // For year, handle 2-digit input
      const fullYear = newPartial.year < 100 ? 2000 + newPartial.year : newPartial.year;
      
      // Create new date with all parts
      let newDate = setYear(baseDate, fullYear);
      newDate = setMonth(newDate, newPartial.month - 1); // date-fns months are 0-indexed
      newDate = setDate(newDate, newPartial.day);
      
      if (isValid(newDate)) {
        const newDateString = format(newDate, 'yyyy-MM-dd');
        
        // Check date range validity
        const otherDate = side === 'from' ? toValue : fromValue;
        if (otherDate) {
          const otherDateParsed = parseISO(otherDate);
          if (isValid(otherDateParsed)) {
            // Check if dates conflict
            if (side === 'from' && isAfter(newDate, otherDateParsed)) {
              // From date > to date - clear to date
              onToChange('');
            } else if (side === 'to' && isAfter(otherDateParsed, newDate)) {
              // To date < from date - clear from date
              onFromChange('');
            }
          }
        }
        
        // Clear partial state and update actual date
        setPartialDates(prev => ({
          ...prev,
          [side]: null,
        }));
        
        if (side === 'from') {
          onFromChange(newDateString);
        } else {
          onToChange(newDateString);
        }
      }
    }
  }, [fromValue, toValue, partialDates, onFromChange, onToChange]);

  // Handle keyboard input for active part - auto-advance after 2 characters
  useEffect(() => {
    if (!activePart || !inputValue) return;

    const numValue = parseInt(inputValue, 10);
    if (isNaN(numValue)) {
      setInputValue('');
      setActivePart(null);
      return;
    }

    // Update partial state immediately for UI feedback
    const currentPartial = activePart.side === 'from' ? partialDates.from : partialDates.to;
    const newPartial = {
      ...(currentPartial || {}),
      [activePart.part]: numValue,
    };
    
    setPartialDates(prev => ({
      ...prev,
      [activePart.side]: newPartial,
    }));

    // If 2 characters typed, immediately move to next section or commit if year
    if (inputValue.length >= 2) {
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Update the date part
      updateDatePart(activePart.side, activePart.part, numValue);
      
      // Auto-advance to next part or commit if year
      const nextPart: DatePart | null = 
        activePart.part === 'day' ? 'month' :
        activePart.part === 'month' ? 'year' :
        null;
      
      if (nextPart) {
        setActivePart({ side: activePart.side, part: nextPart });
        setInputValue('');
      } else {
        // Year - commit immediately
        setInputValue('');
        setActivePart(null);
      }
    } else {
      // Single character - debounce for potential second character
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        // If still single character after debounce, update and advance
        updateDatePart(activePart.side, activePart.part, numValue);
        
        const nextPart: DatePart | null = 
          activePart.part === 'day' ? 'month' :
          activePart.part === 'month' ? 'year' :
          null;
        
        if (nextPart) {
          setActivePart({ side: activePart.side, part: nextPart });
        } else {
          setActivePart(null);
        }
        setInputValue('');
      }, 500);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [activePart, inputValue, updateDatePart, partialDates]);

  // Handle keyboard input and click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activePart) return;
      
      // Only handle numeric keys
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setInputValue(prev => prev + e.key);
      } else if (e.key === 'Escape') {
        const currentSide = activePart.side;
        setActivePart(null);
        setInputValue('');
        // Clear partial dates for this side
        setPartialDates(prev => ({
          ...prev,
          [currentSide]: null,
        }));
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // When clicking outside, commit any partial dates (even incomplete) to filters
        setPartialDates(prev => {
          const newPartial = { ...prev };
          
          // Commit from date - use existing date as base, or today if none
          if (prev.from && (prev.from.day !== undefined || prev.from.month !== undefined || prev.from.year !== undefined)) {
            const baseDate = fromValue ? parseISO(fromValue) : parseISO(getTodayLocalDate());
            if (isValid(baseDate)) {
              let newDate = baseDate;
              
              // Apply partial values, using existing values as fallback
              if (prev.from.year !== undefined) {
                const fullYear = prev.from.year < 100 ? 2000 + prev.from.year : prev.from.year;
                newDate = setYear(newDate, fullYear);
              }
              if (prev.from.month !== undefined) {
                newDate = setMonth(newDate, prev.from.month - 1);
              }
              if (prev.from.day !== undefined) {
                newDate = setDate(newDate, prev.from.day);
              }
              
              if (isValid(newDate)) {
                const newDateString = format(newDate, 'yyyy-MM-dd');
                // Check date range validity
                if (toValue) {
                  const toDateParsed = parseISO(toValue);
                  if (isValid(toDateParsed) && isAfter(newDate, toDateParsed)) {
                    // From date > to date - clear to date
                    onToChange('');
                  } else {
                    onFromChange(newDateString);
                  }
                } else {
                  onFromChange(newDateString);
                }
              }
            }
            newPartial.from = null;
          }
          
          // Commit to date - use existing date as base, or today if none
          if (prev.to && (prev.to.day !== undefined || prev.to.month !== undefined || prev.to.year !== undefined)) {
            const baseDate = toValue ? parseISO(toValue) : parseISO(getTodayLocalDate());
            if (isValid(baseDate)) {
              let newDate = baseDate;
              
              // Apply partial values, using existing values as fallback
              if (prev.to.year !== undefined) {
                const fullYear = prev.to.year < 100 ? 2000 + prev.to.year : prev.to.year;
                newDate = setYear(newDate, fullYear);
              }
              if (prev.to.month !== undefined) {
                newDate = setMonth(newDate, prev.to.month - 1);
              }
              if (prev.to.day !== undefined) {
                newDate = setDate(newDate, prev.to.day);
              }
              
              if (isValid(newDate)) {
                const newDateString = format(newDate, 'yyyy-MM-dd');
                // Check date range validity
                if (fromValue) {
                  const fromDateParsed = parseISO(fromValue);
                  if (isValid(fromDateParsed) && isAfter(fromDateParsed, newDate)) {
                    // To date < from date - clear from date
                    onFromChange('');
                  } else {
                    onToChange(newDateString);
                  }
                } else {
                  onToChange(newDateString);
                }
              }
            }
            newPartial.to = null;
          }
          
          return newPartial;
        });
        
        setActivePart(null);
        setInputValue('');
      }
    };

    if (activePart) {
      window.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [activePart, fromValue, toValue, onFromChange, onToChange]);

  // Handle incrementing both dates by one day
  const handleIncrement = () => {
    const fromDate = fromValue || getTodayLocalDate();
    const toDate = toValue || getTodayLocalDate();
    
    try {
      const fromParsed = parseISO(fromDate);
      const toParsed = parseISO(toDate);
      
      if (!isValid(fromParsed) || !isValid(toParsed)) return;
      
      const newFrom = format(addDays(fromParsed, 1), 'yyyy-MM-dd');
      const newTo = format(addDays(toParsed, 1), 'yyyy-MM-dd');
      
      // Check for conflicts - if from > to after increment, clear the other date
      const newFromParsed = parseISO(newFrom);
      const newToParsed = parseISO(newTo);
      
      if (isValid(newFromParsed) && isValid(newToParsed)) {
        if (isAfter(newFromParsed, newToParsed)) {
          // From > to - clear to date
          onFromChange(newFrom);
          onToChange('');
        } else {
          onFromChange(newFrom);
          onToChange(newTo);
        }
      }
    } catch {
      // Invalid date, ignore
    }
  };

  // Handle decrementing both dates by one day
  const handleDecrement = () => {
    const fromDate = fromValue || getTodayLocalDate();
    const toDate = toValue || getTodayLocalDate();
    
    try {
      const fromParsed = parseISO(fromDate);
      const toParsed = parseISO(toDate);
      
      if (!isValid(fromParsed) || !isValid(toParsed)) return;
      
      const newFrom = format(subDays(fromParsed, 1), 'yyyy-MM-dd');
      const newTo = format(subDays(toParsed, 1), 'yyyy-MM-dd');
      
      // Check for conflicts - if to < from after decrement, clear the other date
      const newFromParsed = parseISO(newFrom);
      const newToParsed = parseISO(newTo);
      
      if (isValid(newFromParsed) && isValid(newToParsed)) {
        if (isAfter(newFromParsed, newToParsed)) {
          // From > to - clear from date
          onFromChange('');
          onToChange(newTo);
        } else {
          onFromChange(newFrom);
          onToChange(newTo);
        }
      }
    } catch {
      // Invalid date, ignore
    }
  };

  // Handle clearing a date
  const handleClearDate = (side: DateSide, e: React.MouseEvent) => {
    e.stopPropagation();
    // Clear both the date and partial state
    setPartialDates(prev => ({
      ...prev,
      [side]: null,
    }));
    if (side === 'from') {
      onFromChange('');
    } else {
      onToChange('');
    }
  };

  // Handle clicking on a date part
  const handlePartClick = (side: DateSide, part: DatePart, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setActivePart({ side, part });
    setInputValue('');
  };

  // Handle clicking on date to open native calendar
  const handleDateClick = (side: DateSide, e: React.MouseEvent) => {
    // Don't trigger if clicking on a date part button or clear button
    const target = e.target as HTMLElement;
    // Check if click is on a button (date part or clear button)
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    const dateInput = side === 'from' ? fromDateInputRef.current : toDateInputRef.current;
    if (dateInput) {
      // showPicker() is supported in modern browsers
      if (typeof dateInput.showPicker === 'function') {
        dateInput.showPicker();
      } else {
        // Fallback: focus and click
        dateInput.focus();
        dateInput.click();
      }
    }
  };

  // Handle native date input change
  const handleNativeDateChange = (side: DateSide, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      // Check date range validity
      const otherDate = side === 'from' ? toValue : fromValue;
      if (otherDate) {
        const newDateParsed = parseISO(value);
        const otherDateParsed = parseISO(otherDate);
        if (isValid(newDateParsed) && isValid(otherDateParsed)) {
          // Check if dates conflict
          if (side === 'from' && isAfter(newDateParsed, otherDateParsed)) {
            // From date > to date - clear to date
            onToChange('');
          } else if (side === 'to' && isAfter(otherDateParsed, newDateParsed)) {
            // To date < from date - clear from date
            onFromChange('');
          }
        }
      }
      
      if (side === 'from') {
        onFromChange(value);
      } else {
        onToChange(value);
      }
      
      // Clear partial state for this side
      setPartialDates(prev => ({
        ...prev,
        [side]: null,
      }));
    }
  };

  // Render date with clickable parts
  const renderDate = (side: DateSide, dateString: string) => {
    const partial = side === 'from' ? partialDates.from : partialDates.to;
    const hasPartial = partial && (partial.day !== undefined || partial.month !== undefined || partial.year !== undefined);
    
    // If we have a full date, use it; otherwise use partial with current date as base
    let displayParts: { day?: number; month?: number; year?: number } | null = null;
    
    if (dateString && !hasPartial) {
      // Use the actual date value
      displayParts = getDateParts(dateString);
    } else {
      // Use current date value as base (or today if none), then override with partial values
      const currentDateValue = side === 'from' ? fromValue : toValue;
      const baseDate = currentDateValue ? parseISO(currentDateValue) : parseISO(getTodayLocalDate());
      
      if (isValid(baseDate)) {
        const baseParts = {
          day: getDate(baseDate),
          month: getMonth(baseDate),
          year: getYear(baseDate),
        };
        
        // Override with partial values if they exist
        displayParts = {
          day: partial?.day !== undefined ? partial.day : baseParts.day,
          month: partial?.month !== undefined ? partial.month - 1 : baseParts.month, // Convert to 0-indexed
          year: partial?.year !== undefined ? (partial.year < 100 ? 2000 + partial.year : partial.year) : baseParts.year,
        };
      }
    }

    const isActive = activePart?.side === side;
    const isDayActive = isActive && activePart?.part === 'day';
    const isMonthActive = isActive && activePart?.part === 'month';
    const isYearActive = isActive && activePart?.part === 'year';

    // Get display values or placeholders
    const dayDisplay = displayParts?.day !== undefined 
      ? String(displayParts.day).padStart(2, '0')
      : 'dd';
    const monthDisplay = displayParts?.month !== undefined
      ? String(displayParts.month + 1).padStart(2, '0')
      : 'mm';
    const yearDisplay = displayParts?.year !== undefined
      ? String(displayParts.year).slice(-2)
      : 'yy';

    const isEmpty = !dateString && !hasPartial;

    return (
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={(e) => handlePartClick(side, 'day', e)}
          className={cn(
            "px-1 py-0.5 rounded text-sm font-mono transition-colors",
            isDayActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            isEmpty && "opacity-40"
          )}
        >
          {dayDisplay}
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={(e) => handlePartClick(side, 'month', e)}
          className={cn(
            "px-1 py-0.5 rounded text-sm font-mono transition-colors",
            isMonthActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            isEmpty && "opacity-40"
          )}
        >
          {monthDisplay}
        </button>
        <span>/</span>
        <button
          type="button"
          onClick={(e) => handlePartClick(side, 'year', e)}
          className={cn(
            "px-1 py-0.5 rounded text-sm font-mono transition-colors",
            isYearActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            isEmpty && "opacity-40"
          )}
        >
          {yearDisplay}
        </button>
        {dateString && (
          <button
            type="button"
            onClick={(e) => handleClearDate(side, e)}
            className="ml-1 p-0.5 hover:bg-muted rounded opacity-60 hover:opacity-100 transition-opacity"
            aria-label={`Clear ${side} date`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className={cn('flex items-center gap-1 border rounded-md', className)}>
      {/* Hidden native date inputs for calendar widget */}
      <input
        ref={fromDateInputRef}
        type="date"
        value={fromValue || ''}
        onChange={(e) => handleNativeDateChange('from', e)}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={toDateInputRef}
        type="date"
        value={toValue || ''}
        onChange={(e) => handleNativeDateChange('to', e)}
        className="hidden"
        aria-hidden="true"
      />

      {/* Left Arrow Button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDecrement}
        className="rounded-r-none h-9 px-1 shrink-0"
        aria-label="Decrement dates"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Date Range Display */}
      <div className="flex items-center gap-0.5 px-0.5 py-1.5 min-w-0 flex-1 justify-center">
        {/* From Date */}
        <div
          onClick={(e) => handleDateClick('from', e)}
          className="flex items-center hover:bg-muted/50 rounded px-1 py-0.5 transition-colors cursor-pointer"
          title="Click to open calendar or click date parts to edit"
        >
          {renderDate('from', fromValue)}
        </div>

        <span className="text-muted-foreground mx-1">-</span>

        {/* To Date */}
        <div
          onClick={(e) => handleDateClick('to', e)}
          className="flex items-center hover:bg-muted/50 rounded px-1 py-0.5 transition-colors cursor-pointer"
          title="Click to open calendar or click date parts to edit"
        >
          {renderDate('to', toValue)}
        </div>
      </div>

      {/* Right Arrow Button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleIncrement}
        className="rounded-l-none h-9 px-1 shrink-0"
        aria-label="Increment dates"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

