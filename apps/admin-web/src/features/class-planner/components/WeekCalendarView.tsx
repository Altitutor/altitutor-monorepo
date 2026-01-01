'use client';

import { useMemo } from 'react';
import { Button } from '@altitutor/ui';
import { Card } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import type { DraftClassPlanWithDetails } from '../api/classPlans';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import { formatTime } from '@/shared/utils/datetime';

interface WeekCalendarViewProps {
  plan: DraftClassPlanWithDetails;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

export function WeekCalendarView({ plan }: WeekCalendarViewProps) {
  // Group slots by day
  const slotsByDay = useMemo(() => {
    const grouped: Record<number, typeof plan.slots> = {};
    DAYS_OF_WEEK.forEach((day) => {
      grouped[day.value] = plan.slots.filter((slot) => slot.day_of_week === day.value);
    });
    return grouped;
  }, [plan.slots]);

  // Group classes by day and slot
  const classesByDaySlot = useMemo(() => {
    const grouped: Record<number, Record<string, typeof plan.classes>> = {};
    DAYS_OF_WEEK.forEach((day) => {
      grouped[day.value] = {};
      slotsByDay[day.value].forEach((slot) => {
        const slotKey = `${slot.start_time}-${slot.end_time}`;
        grouped[day.value][slotKey] = plan.classes.filter(
          (cls) =>
            cls.day_of_week === day.value &&
            cls.start_time === slot.start_time &&
            cls.end_time === slot.end_time
        );
      });
    });
    return grouped;
  }, [plan.classes, slotsByDay]);

  const handleCreateClass = (dayOfWeek: number, startTime: string, endTime: string) => {
    // TODO: Open create class modal
    console.log('Create class', { dayOfWeek, startTime, endTime });
  };

  return (
    <div className="p-4 h-full overflow-auto">
      <div className="grid grid-cols-7 gap-2">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day.value} className="border rounded-lg p-2">
            <div className="font-semibold text-sm mb-2 sticky top-0 bg-background z-10">
              {day.label}
            </div>
            <div className="space-y-2">
              {slotsByDay[day.value].length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  No slots configured
                </div>
              ) : (
                slotsByDay[day.value].map((slot) => {
                  const slotKey = `${slot.start_time}-${slot.end_time}`;
                  const classes = classesByDaySlot[day.value]?.[slotKey] || [];
                  return (
                    <div
                      key={slotKey}
                      className="border rounded p-2 min-h-[100px] bg-muted/30"
                    >
                      <div className="text-xs text-muted-foreground mb-1">
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                      </div>
                      <div className="space-y-1">
                        {classes.map((cls) => {
                          const subject = cls.subject;
                          const { style, textColorClass } = subject
                            ? getSubjectColorStyle(subject)
                            : { style: {}, textColorClass: 'text-gray-800' };
                          return (
                            <Card
                              key={cls.id}
                              className="p-2 text-xs cursor-pointer hover:shadow-md transition-shadow"
                              style={style}
                            >
                              <div className={`font-medium ${textColorClass}`}>
                                {subject ? formatSubjectDisplay(subject) : 'No Subject'}
                              </div>
                              {cls.level && (
                                <div className="text-xs text-muted-foreground">{cls.level}</div>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {cls.students.length} student{cls.students.length !== 1 ? 's' : ''}
                              </div>
                            </Card>
                          );
                        })}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-8 text-xs"
                          onClick={() => handleCreateClass(day.value, slot.start_time, slot.end_time)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Class
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
