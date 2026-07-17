'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay, parseISO, isBefore, isPast } from 'date-fns';
import { Button, SmartDatePickerField } from '@altitutor/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SkeletonTimeSlotGrid } from '@altitutor/ui';
import { useAvailableSlots } from '../hooks/useAvailableSlots';
import type { GetAvailableSlotsParams, AvailableSlot } from '../api/availability';
import { studentBtnOutline, studentBtnPrimary } from '@/shared/lib/student-visual';
import { cn, navActiveStyles, navHoverStyles, navItemTransitionStyles } from '@/shared/utils';
import { ContactUsDialog } from './ContactUsDialog';

const DATE_JUMP_HIGHLIGHT_MS = 1600;

interface TimeSlotPickerProps {
  sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  subjectId?: string;
  durationMinutes?: number;
  /** Minimum advance booking days; should match booking_settings.min_advance_booking_days */
  minAdvanceDays?: number;
  onSlotSelect: (startAt: string, endAt: string, availableStaffIds: string[]) => void;
  selectedSlot?: { startAt: string; endAt: string } | null;
  className?: string;
  allowAnonymous?: boolean; // Skip reservations for anonymous users
}

export function TimeSlotPicker({
  sessionType,
  subjectId,
  durationMinutes = 60,
  minAdvanceDays = 1,
  onSlotSelect,
  selectedSlot,
  className,
  allowAnonymous: _allowAnonymous = false,
}: TimeSlotPickerProps) {
  // Minimum booking date matches get_available_slots / booking_settings.min_advance_booking_days
  const today = new Date();
  const minBookingDate = addDays(today, minAdvanceDays);
  const minBookingWeekStart = startOfWeek(minBookingDate, { weekStartsOn: 1 });
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Start from minimum booking week, not current week
    const todayWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    return isBefore(minBookingWeekStart, todayWeekStart) ? todayWeekStart : minBookingWeekStart;
  });
  // Keep the date picker on the date the user jumped to (not always the Monday).
  const [pickerDate, setPickerDate] = useState(() => format(currentWeekStart, 'yyyy-MM-dd'));
  const [highlightedDateKey, setHighlightedDateKey] = useState<string | null>(null);
  
  const weekDays = useMemo(() => {
    // Show all days of the week, don't filter out past dates
    return eachDayOfInterval({
      start: currentWeekStart,
      end: addDays(currentWeekStart, 6),
    });
  }, [currentWeekStart]);

  // Calculate date range for API call - ensure we don't request past dates
  const effectiveStartDate = useMemo(() => {
    const weekStartDate = currentWeekStart < minBookingDate ? minBookingDate : currentWeekStart;
    return format(weekStartDate, 'yyyy-MM-dd');
  }, [currentWeekStart, minBookingDate]);
  
  const startDate = effectiveStartDate;
  const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');

  const params: GetAvailableSlotsParams = {
    start_date: startDate,
    end_date: endDate,
    session_type: sessionType,
    subject_id: subjectId,
    duration_minutes: durationMinutes,
  };

  const { data: slots, isLoading } = useAvailableSlots(params);

  // Check for slots in a wider range (next 12 weeks) to determine if any slots exist
  const wideRangeParams: GetAvailableSlotsParams = {
    start_date: format(minBookingDate, 'yyyy-MM-dd'),
    end_date: format(addDays(minBookingDate, 84), 'yyyy-MM-dd'), // 12 weeks
    session_type: sessionType,
    subject_id: subjectId,
    duration_minutes: durationMinutes,
  };
  const { data: allSlots } = useAvailableSlots(wideRangeParams);

  // Auto-jump to first week with slots
  useEffect(() => {
    if (!isLoading && allSlots && currentWeekStart.getTime() === minBookingWeekStart.getTime()) {
      // Find the first week with available slots
      const allAvailableSlots = allSlots.filter(slot => {
        const slotDate = parseISO(slot.start_at);
        return slot.is_available && slot.available_staff_ids.length > 0 && !isPast(slotDate);
      });

      if (allAvailableSlots.length > 0) {
        // Find the earliest slot
        const earliestSlot = allAvailableSlots.reduce((earliest, current) => {
          return parseISO(current.start_at) < parseISO(earliest.start_at) ? current : earliest;
        });

        const earliestSlotDate = parseISO(earliestSlot.start_at);
        const earliestWeekStart = startOfWeek(earliestSlotDate, { weekStartsOn: 1 });
        
        // Only jump if it's different from current week
        if (earliestWeekStart.getTime() !== currentWeekStart.getTime()) {
          setCurrentWeekStart(earliestWeekStart);
          setPickerDate(format(earliestWeekStart, 'yyyy-MM-dd'));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, allSlots]);

  useEffect(() => {
    if (!highlightedDateKey) return;
    const timeoutId = window.setTimeout(() => {
      setHighlightedDateKey(null);
    }, DATE_JUMP_HIGHLIGHT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [highlightedDateKey]);

  // Group slots by date and filter out past slots
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, AvailableSlot[]> = {};
    const now = new Date();
    
    slots?.forEach((slot) => {
      const slotDate = parseISO(slot.start_at);
      // Filter out past slots
      if (isPast(slotDate) && !isSameDay(slotDate, now)) {
        return;
      }
      
      const dateKey = format(slotDate, 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(slot);
    });
    return grouped;
  }, [slots]);

  // Check if there are any slots ever available
  const hasAnySlots = useMemo(() => {
    if (!allSlots) return true; // Assume slots exist while loading
    return allSlots.some(slot => {
      const slotDate = parseISO(slot.start_at);
      return slot.is_available && slot.available_staff_ids.length > 0 && !isPast(slotDate);
    });
  }, [allSlots]);

  // Check if current week has any available slots
  const hasSlotsInCurrentWeek = useMemo(() => {
    return weekDays.some((day) => {
      const isPastDate = isPast(day) && !isSameDay(day, new Date());
      if (isPastDate) return false;
      const dateKey = format(day, 'yyyy-MM-dd');
      const daySlots = slotsByDate[dateKey] || [];
      return daySlots.some(
        (s) => s.is_available && s.available_staff_ids.length > 0
      );
    });
  }, [weekDays, slotsByDate]);

  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  const handleSlotClick = (slot: AvailableSlot) => {
    if (!slot.is_available || slot.available_staff_ids.length === 0) {
      return;
    }

    // Just select the slot, don't auto-proceed
    // The parent component will handle proceeding when "Next" is clicked
    onSlotSelect(slot.start_at, slot.end_at, slot.available_staff_ids);
  };

  const formatTime = (isoString: string) => {
    const date = parseISO(isoString);
    return format(date, 'h:mm a');
  };

  const isSlotSelected = (slot: AvailableSlot) => {
    return selectedSlot?.startAt === slot.start_at && selectedSlot?.endAt === slot.end_at;
  };

  const navigateToWeek = (nextWeekStart: Date, displayDate: Date) => {
    const clampedWeekStart = isBefore(nextWeekStart, minBookingWeekStart)
      ? minBookingWeekStart
      : nextWeekStart;
    setCurrentWeekStart(clampedWeekStart);
    setPickerDate(format(displayDate, 'yyyy-MM-dd'));
  };

  const handleDateJump = (value: string | null) => {
    if (!value) return;
    const selectedDate = parseISO(value);
    const selectedWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    navigateToWeek(selectedWeekStart, selectedDate);
    setHighlightedDateKey(format(selectedDate, 'yyyy-MM-dd'));
  };

  const handlePreviousWeek = () => {
    const nextWeekStart = addDays(currentWeekStart, -7);
    navigateToWeek(nextWeekStart, nextWeekStart);
  };

  const handleNextWeek = () => {
    const nextWeekStart = addDays(currentWeekStart, 7);
    navigateToWeek(nextWeekStart, nextWeekStart);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className={studentBtnOutline}
          onClick={handlePreviousWeek}
          disabled={isBefore(currentWeekStart, minBookingWeekStart) || isSameDay(currentWeekStart, minBookingWeekStart)}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous Week
        </Button>
        
        <SmartDatePickerField
          value={pickerDate}
          onChange={handleDateJump}
          minDate={format(minBookingDate, 'yyyy-MM-dd')}
          placeholder="Type a date"
          className="h-9 w-[13rem] text-center"
        />
        
        <Button
          variant="outline"
          size="sm"
          className={studentBtnOutline}
          onClick={handleNextWeek}
        >
          Next Week
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <SkeletonTimeSlotGrid />
      ) : !hasAnySlots ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">
            No slots available at the moment.
          </p>
          <Button className={studentBtnPrimary} onClick={() => setIsContactDialogOpen(true)}>
            Contact us
          </Button>
        </div>
      ) : !hasSlotsInCurrentWeek ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">No slots this week.</p>
          <Button className={studentBtnPrimary} onClick={() => setIsContactDialogOpen(true)}>
            Contact us
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const daySlots = slotsByDate[dateKey] || [];
            const isToday = isSameDay(day, new Date());
            const isPastDate = isPast(day) && !isToday;
            const isJumpHighlighted = highlightedDateKey === dateKey;

            return (
              <div key={dateKey} className="space-y-2">
                {/* Day Header */}
                <div className={cn(
                  'text-center text-sm font-medium py-2 rounded border border-transparent',
                  navItemTransitionStyles,
                  'transition-colors duration-500',
                  (isToday || isJumpHighlighted) && navActiveStyles,
                  isJumpHighlighted && 'ring-2 ring-border',
                  isPastDate && 'text-muted-foreground'
                )}>
                  <div>{format(day, 'EEE')}</div>
                  <div className="text-xs">
                    {format(day, 'd MMM')}
                  </div>
                </div>

                {/* Time Slots */}
                <div className="space-y-1 min-h-[200px]">
                  {isPastDate ? (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      Past date
                    </div>
                  ) : daySlots.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No slots
                    </div>
                  ) : (
                    daySlots.map((slot) => {
                      const isAvailable = slot.is_available && slot.available_staff_ids.length > 0;
                      const isSelected = isSlotSelected(slot);

                      return (
                        <button
                          key={`${slot.start_at}-${slot.end_at}`}
                          onClick={() => handleSlotClick(slot)}
                          disabled={!isAvailable}
                          className={cn(
                            'w-full text-xs py-2 px-2 rounded border border-border',
                            navItemTransitionStyles,
                            isSelected
                              ? navActiveStyles
                              : isAvailable
                              ? cn('bg-background', navHoverStyles)
                              : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                          )}
                        >
                          {formatTime(slot.start_at)}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ContactUsDialog
        isOpen={isContactDialogOpen}
        onOpenChange={setIsContactDialogOpen}
      />
    </div>
  );
}
