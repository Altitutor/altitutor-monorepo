'use client';

import * as React from 'react';
import {
  subDays,
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  format,
} from 'date-fns';
import { Input } from './input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { cn } from '../lib/cn';

export interface DateRangeQuickPick {
  id: string;
  label: string;
  getRange: () => { from: string; to: string };
}

const DEFAULT_QUICK_PICKS: DateRangeQuickPick[] = [
  {
    id: 'yesterday',
    label: 'Yesterday',
    getRange: () => {
      const d = subDays(new Date(), 1);
      const s = format(d, 'yyyy-MM-dd');
      return { from: s, to: s };
    },
  },
  {
    id: 'today',
    label: 'Today',
    getRange: () => {
      const d = new Date();
      const s = format(d, 'yyyy-MM-dd');
      return { from: s, to: s };
    },
  },
  {
    id: 'tomorrow',
    label: 'Tomorrow',
    getRange: () => {
      const d = addDays(new Date(), 1);
      const s = format(d, 'yyyy-MM-dd');
      return { from: s, to: s };
    },
  },
  {
    id: 'last-7-days',
    label: 'Last 7 days',
    getRange: () => {
      const today = new Date();
      const from = subDays(today, 6);
      return {
        from: format(from, 'yyyy-MM-dd'),
        to: format(today, 'yyyy-MM-dd'),
      };
    },
  },
  {
    id: 'this-calendar-week',
    label: 'This week',
    getRange: () => {
      const today = new Date();
      const start = startOfWeek(today, { weekStartsOn: 1 });
      const end = endOfWeek(today, { weekStartsOn: 1 });
      return {
        from: format(start, 'yyyy-MM-dd'),
        to: format(end, 'yyyy-MM-dd'),
      };
    },
  },
  {
    id: 'last-calendar-week',
    label: 'Last week',
    getRange: () => {
      const lastWeek = subWeeks(new Date(), 1);
      const start = startOfWeek(lastWeek, { weekStartsOn: 1 });
      const end = endOfWeek(lastWeek, { weekStartsOn: 1 });
      return {
        from: format(start, 'yyyy-MM-dd'),
        to: format(end, 'yyyy-MM-dd'),
      };
    },
  },
  {
    id: 'this-calendar-month',
    label: 'This month',
    getRange: () => {
      const today = new Date();
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      return {
        from: format(start, 'yyyy-MM-dd'),
        to: format(end, 'yyyy-MM-dd'),
      };
    },
  },
  {
    id: 'next-week',
    label: 'Next week',
    getRange: () => {
      const nextWeek = addWeeks(new Date(), 1);
      const start = startOfWeek(nextWeek, { weekStartsOn: 1 });
      const end = endOfWeek(nextWeek, { weekStartsOn: 1 });
      return {
        from: format(start, 'yyyy-MM-dd'),
        to: format(end, 'yyyy-MM-dd'),
      };
    },
  },
  {
    id: 'next-month',
    label: 'Next month',
    getRange: () => {
      const nextMonth = addMonths(new Date(), 1);
      const start = startOfMonth(nextMonth);
      const end = endOfMonth(nextMonth);
      return {
        from: format(start, 'yyyy-MM-dd'),
        to: format(end, 'yyyy-MM-dd'),
      };
    },
  },
];

export interface DateRangeFilterProps {
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  /** When provided, quick picks call this instead of onFromChange+onToChange (allows batch update) */
  onRangeChange?: (from: string, to: string) => void;
  quickPicks?: DateRangeQuickPick[];
  fromLabel?: string;
  toLabel?: string;
  searchPlaceholder?: string;
  className?: string;
}

export function DateRangeFilter({
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  onRangeChange,
  quickPicks = DEFAULT_QUICK_PICKS,
  fromLabel = 'From date',
  toLabel = 'To date',
  searchPlaceholder = 'Search quick picks...',
  className,
}: DateRangeFilterProps) {
  const [search, setSearch] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const input = inputRef.current;
    if (input) {
      requestAnimationFrame(() => input.focus());
    }
  }, []);

  const filteredQuickPicks = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quickPicks;
    return quickPicks.filter((p) => p.label.toLowerCase().includes(q));
  }, [quickPicks, search]);

  const handleQuickPickSelect = React.useCallback(
    (pick: DateRangeQuickPick) => {
      const { from, to } = pick.getRange();
      if (onRangeChange) {
        onRangeChange(from, to);
      } else {
        onFromChange(from);
        onToChange(to);
      }
    },
    [onFromChange, onToChange, onRangeChange]
  );

  return (
    <div className={cn('flex flex-col gap-3 p-2', className)}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {fromLabel}
          </label>
          <Input
            type="date"
            value={fromValue}
            onChange={(e) => onFromChange(e.target.value)}
            className="h-8 mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {toLabel}
          </label>
          <Input
            type="date"
            value={toValue}
            onChange={(e) => onToChange(e.target.value)}
            className="h-8 mt-1"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 -mx-2 -mb-2">
        <Command
          shouldFilter={false}
          disablePointerSelection={false}
          className="rounded-none border-0"
        >
          <CommandInput
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No quick picks found.</CommandEmpty>
            <CommandGroup>
              {filteredQuickPicks.map((pick) => (
                <CommandItem
                  key={pick.id}
                  value={`${pick.id}-${pick.label}`}
                  onSelect={() => handleQuickPickSelect(pick)}
                >
                  {pick.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>
  );
}
