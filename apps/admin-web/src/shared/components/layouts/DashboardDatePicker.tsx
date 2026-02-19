'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { addDays, format, isValid, parse, startOfWeek } from 'date-fns';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/shared/utils';

const DASHBOARD_DATE_RE = /^\/dashboard\/(\d{4}-\d{2}-\d{2})$/;

function parseDashboardDate(pathname: string): Date | null {
  const match = pathname.match(DASHBOARD_DATE_RE);
  if (!match?.[1]) return null;
  const parsed = parse(match[1], 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : null;
}

export function DashboardDatePicker() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const activeDate = useMemo(() => parseDashboardDate(pathname) || new Date(), [pathname]);
  const [weekAnchor, setWeekAnchor] = useState<Date>(activeDate);

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekAnchor]);

  const activeDateStr = format(activeDate, 'yyyy-MM-dd');

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) {
          setWeekAnchor(activeDate);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 gap-2 px-3">
          <CalendarDays className="h-4 w-4" />
          <span className="text-sm">{format(activeDate, 'dd/MM/yyyy')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekAnchor((prev) => addDays(prev, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium">{format(weekDays[0], 'dd MMM')} - {format(weekDays[6], 'dd MMM yyyy')}</div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekAnchor((prev) => addDays(prev, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isActive = dayStr === activeDateStr;
            return (
              <button
                key={dayStr}
                onClick={() => {
                  router.push(`/dashboard/${dayStr}`);
                  setIsOpen(false);
                }}
                className={cn(
                  'rounded-md border p-2 text-left transition-colors hover:bg-accent/20',
                  isActive && 'bg-accent/30 border-accent'
                )}
              >
                <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                <div className="text-sm font-medium">{format(day, 'dd/MM')}</div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
