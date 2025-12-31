'use client';

import { useState, useMemo } from 'react';
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { Button } from '@altitutor/ui';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAvailableSlots } from '../hooks/useAvailableSlots';
import { useCreateReservation } from '../hooks/useReservations';
import type { GetAvailableSlotsParams, AvailableSlot } from '../api/availability';
import { cn } from '@/shared/utils';

interface TimeSlotPickerProps {
  sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW';
  subjectId?: string;
  durationMinutes?: number;
  onSlotSelect: (startAt: string, endAt: string) => void;
  selectedSlot?: { startAt: string; endAt: string } | null;
  className?: string;
  allowAnonymous?: boolean; // Skip reservations for anonymous users
}

export function TimeSlotPicker({
  sessionType,
  subjectId,
  durationMinutes = 60,
  onSlotSelect,
  selectedSlot,
  className,
  allowAnonymous = false,
}: TimeSlotPickerProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  
  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: currentWeekStart,
      end: addDays(currentWeekStart, 6),
    });
  }, [currentWeekStart]);

  const startDate = format(currentWeekStart, 'yyyy-MM-dd');
  const endDate = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');

  const params: GetAvailableSlotsParams = {
    start_date: startDate,
    end_date: endDate,
    session_type: sessionType,
    subject_id: subjectId,
    duration_minutes: durationMinutes,
  };

  const { data: slots, isLoading } = useAvailableSlots(params);
  const createReservation = useCreateReservation();

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, AvailableSlot[]> = {};
    slots?.forEach((slot) => {
      const dateKey = format(parseISO(slot.start_at), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(slot);
    });
    return grouped;
  }, [slots]);

  const handleSlotClick = async (slot: AvailableSlot) => {
    if (!slot.is_available || slot.available_staff_ids.length === 0) {
      return;
    }

    try {
      // Skip reservation for anonymous users
      if (!allowAnonymous) {
        // Create reservation
        await createReservation.mutateAsync({
          start_at: slot.start_at,
          end_at: slot.end_at,
          session_type: sessionType,
          subject_id: subjectId,
        });
      }

      // Call onSlotSelect callback
      onSlotSelect(slot.start_at, slot.end_at);
    } catch (error) {
      console.error('Failed to reserve slot:', error);
    }
  };

  const formatTime = (isoString: string) => {
    const date = parseISO(isoString);
    return format(date, 'h:mm a');
  };

  const isSlotSelected = (slot: AvailableSlot) => {
    return selectedSlot?.startAt === slot.start_at && selectedSlot?.endAt === slot.end_at;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous Week
        </Button>
        
        <div className="text-sm font-medium">
          {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
        >
          Next Week
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const daySlots = slotsByDate[dateKey] || [];
            const isToday = isSameDay(day, new Date());

            return (
              <div key={dateKey} className="space-y-2">
                {/* Day Header */}
                <div className={cn(
                  'text-center text-sm font-medium py-2',
                  isToday && 'bg-primary text-primary-foreground rounded'
                )}>
                  <div>{format(day, 'EEE')}</div>
                  <div className={cn('text-xs', isToday && 'text-primary-foreground')}>
                    {format(day, 'd')}
                  </div>
                </div>

                {/* Time Slots */}
                <div className="space-y-1 min-h-[200px]">
                  {daySlots.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No slots
                    </div>
                  ) : (
                    daySlots.map((slot) => {
                      const isAvailable = slot.is_available && slot.available_staff_ids.length > 0;
                      const isSelected = isSlotSelected(slot);
                      const isReserving = createReservation.isPending;

                      return (
                        <button
                          key={`${slot.start_at}-${slot.end_at}`}
                          onClick={() => handleSlotClick(slot)}
                          disabled={!isAvailable || isReserving}
                          className={cn(
                            'w-full text-xs py-2 px-2 rounded border transition-colors',
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : isAvailable
                              ? 'bg-background hover:bg-muted border-border'
                              : 'bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50'
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
    </div>
  );
}

