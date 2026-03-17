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
  const todayStr = format(new Date(), 'yyyy-MM-dd');

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
        <Button variant="outline" className="h-9 gap-2 px-3 md:px-3 px-2">
          <CalendarDays className="h-4 w-4" />
          <span className="hidden md:inline text-sm">{format(activeDate, 'dd/MM/yyyy')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] max-w-[calc(100vw-2rem)] p-3" collisionPadding={16}>
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
            const isToday = dayStr === todayStr;
            return (
              <button
                key={dayStr}
                onClick={() => {
                  router.push(`/dashboard/${dayStr}`);
                  setIsOpen(false);
                }}
                className={cn(
                  'rounded-md border px-1 py-2 text-center transition-colors hover:bg-accent/20 min-w-0 h-[68px] flex flex-col items-center justify-center',
                  isToday && 'border-brand-lightBlue bg-brand-lightBlue/10',
                  isActive && 'bg-accent/30 border-accent'
                )}
              >
                <div className="text-[11px] leading-tight text-muted-foreground whitespace-nowrap">{format(day, 'EEE')}</div>
                <div className="text-xs font-semibold leading-tight whitespace-nowrap">{format(day, 'dd/MM')}</div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
