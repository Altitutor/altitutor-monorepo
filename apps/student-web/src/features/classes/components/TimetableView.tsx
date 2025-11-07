'use client';

import { Card } from '@altitutor/ui';
import { cn } from '@/shared/utils/index';
import { formatTime } from '@/shared/utils/datetime';
import { getSubjectCurriculumColor } from '@/shared/utils/enum-colors';

interface Class {
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  subject_name: string;
  subject_curriculum: string;
  enrollment_status: string;
}

interface TimetableViewProps {
  classes: Class[];
  onClassClick: (classId: string) => void;
}

interface TimeSlot {
  hour: number;
  minute: number;
  label: string;
  value: string; // HH:MM format
}

interface ClassPosition {
  class: Class;
  top: number;
  height: number;
  left: number;
  width: number;
}

export function TimetableView({ classes, onClassClick }: TimetableViewProps) {
  const days = [
    { name: 'Monday', value: 1, short: 'Mon' },
    { name: 'Tuesday', value: 2, short: 'Tue' },
    { name: 'Wednesday', value: 3, short: 'Wed' },
    { name: 'Thursday', value: 4, short: 'Thu' },
    { name: 'Friday', value: 5, short: 'Fri' },
    { name: 'Saturday', value: 6, short: 'Sat' },
    { name: 'Sunday', value: 0, short: 'Sun' },
  ];

  // Filter days that have classes
  const activeDays = days.filter(day => 
    classes.some(cls => cls.day_of_week === day.value)
  );

  // Generate time slots from 9am to 8pm
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    for (let hour = 9; hour <= 20; hour++) {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour;
      const label = `${displayHour}:00 ${ampm}`;
      const value = `${hour.toString().padStart(2, '0')}:00`;
      
      slots.push({ hour, minute: 0, label, value });
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Convert time string to minutes from start of day
  const timeToMinutes = (timeString: string): number => {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Calculate position of a class block relative to the timetable grid
  const calculateClassPosition = (cls: Class): ClassPosition => {
    const startMinutes = timeToMinutes(cls.start_time);
    const endMinutes = timeToMinutes(cls.end_time);
    const duration = endMinutes - startMinutes;
    
    // Position from 9am (540 minutes) - each hour slot is 60px
    const timetableStartMinutes = 9 * 60; // 9am in minutes (540)
    const minutesFromTimetableStart = startMinutes - timetableStartMinutes;
    const slotHeight = 60; // pixels per hour slot
    
    // Calculate position in the grid
    const top = Math.max(0, (minutesFromTimetableStart / 60) * slotHeight);
    const height = Math.max((duration / 60) * slotHeight, 30); // Minimum 30px height
    
    return {
      class: cls,
      top,
      height,
      left: 2.5,
      width: 95,
    };
  };

  // Get classes for each visible day
  const getClassesForDay = (dayValue: number): ClassPosition[] => {
    const dayClasses = classes
      .filter(cls => cls.day_of_week === dayValue)
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    
    return dayClasses.map(cls => calculateClassPosition(cls));
  };

  // Get color for class based on curriculum
  const getClassColor = (cls: Class): string => {
    if (cls.subject_curriculum) {
      const curriculumColor = getSubjectCurriculumColor(cls.subject_curriculum);
      return `${curriculumColor} border-2 dark:bg-opacity-80`;
    }
    return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600';
  };

  if (activeDays.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No classes found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Timetable Grid */}
      <div className="flex-1 overflow-auto">
        <div 
          className="grid gap-0 min-h-full relative bg-background"
          style={{ 
            gridTemplateColumns: `minmax(80px, 120px) repeat(${activeDays.length}, minmax(200px, 1fr))`,
          }}
        >
          {/* Headers */}
          <div className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r">
            Time
          </div>
          
          {activeDays.map((day) => (
            <div key={day.value} className="sticky top-0 z-20 p-2 text-center font-medium bg-background border-b border-r">
              {day.name}
            </div>
          ))}
          
          {/* Time slots and day columns */}
          {timeSlots.map((timeSlot, timeIndex) => (
            <div key={timeSlot.value} className="contents">
              {/* Time label */}
              <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[60px] flex items-center justify-center">
                {timeSlot.label}
              </div>
              
              {/* Day columns */}
              {activeDays.map((day) => (
                <div 
                  key={`${day.value}-${timeSlot.value}`} 
                  className="relative border-b border-r bg-background h-[60px]"
                  style={{
                    position: 'relative'
                  }}
                >
                  {/* Only render classes in the first time slot to avoid duplicates */}
                  {timeIndex === 0 && (
                    <div className="absolute inset-0" style={{ height: `${timeSlots.length * 60}px` }}>
                      {getClassesForDay(day.value).map((position) => (
                        <div
                          key={position.class.class_id}
                          className={cn(
                            'absolute cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] rounded p-2 border-2 text-xs font-medium overflow-hidden',
                            getClassColor(position.class)
                          )}
                          style={{
                            top: `${position.top}px`,
                            height: `${Math.max(position.height, 45)}px`,
                            left: `${position.left}%`,
                            width: `${position.width}%`,
                            zIndex: 15,
                            minHeight: '45px'
                          }}
                          onClick={() => onClassClick(position.class.class_id)}
                          title={position.class.subject_name}
                        >
                          {/* Subject name */}
                          <div className="font-semibold truncate text-xs leading-tight">
                            {position.class.subject_name}
                          </div>
                          
                          {/* Room */}
                          {position.class.room && (
                            <div className="text-xs opacity-75 truncate leading-tight">
                              Room {position.class.room}
                            </div>
                          )}
                          
                          {/* Time */}
                          <div className="text-xs opacity-90 truncate leading-tight mt-1">
                            {formatTime(position.class.start_time)} - {formatTime(position.class.end_time)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

