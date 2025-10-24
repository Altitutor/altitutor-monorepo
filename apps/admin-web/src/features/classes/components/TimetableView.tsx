'use client';

import { Card } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { cn, formatSubjectDisplay } from '@/shared/utils/index';
import { formatTime } from '@/shared/utils/datetime';
import { getSubjectDisciplineColor, getSubjectCurriculumColor } from '@/shared/utils/enum-colors';

interface TimetableViewProps {
  classes: Tables<'classes'>[];
  classSubjects?: Record<string, Tables<'subjects'>>;
  classStudents?: Record<string, Tables<'students'>[]>;
  classStaff?: Record<string, Tables<'staff'>[]>;
  onClassClick: (cls: Tables<'classes'>) => void;
}

interface TimeSlot {
  hour: number;
  minute: number;
  label: string;
  value: string; // HH:MM format
}

interface ClassPosition {
  class: Tables<'classes'>;
  top: number;
  height: number;
  left: number;
  width: number;
  overlapIndex: number;
  totalOverlaps: number;
}

export function TimetableView({ 
  classes, 
  classSubjects, 
  classStudents, 
  classStaff, 
  onClassClick 
}: TimetableViewProps) {
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
  const calculateClassPosition = (
    cls: Tables<'classes'>, 
    overlappingClasses: Tables<'classes'>[]
  ): ClassPosition => {
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
    
    // Calculate overlapping positions
    const overlapIndex = overlappingClasses.findIndex(c => c.id === cls.id);
    const totalOverlaps = overlappingClasses.length;
    const columnWidth = totalOverlaps > 1 ? 95 / totalOverlaps : 95; // Leave some margin
    const left = (overlapIndex * columnWidth) + 2.5; // Add small left margin
    
    return {
      class: cls,
      top,
      height,
      left,
      width: columnWidth,
      overlapIndex,
      totalOverlaps
    };
  };

  // Find overlapping classes for a specific day and time range
  const findOverlappingClasses = (dayClasses: Tables<'classes'>[]): Tables<'classes'>[][] => {
    const groups: Tables<'classes'>[][] = [];
    const processed = new Set<string>();
    
    dayClasses.forEach(cls => {
      if (processed.has(cls.id)) return;
      
      const group = [cls];
      processed.add(cls.id);
      
      const clsStart = timeToMinutes(cls.start_time);
      const clsEnd = timeToMinutes(cls.end_time);
      
      dayClasses.forEach(otherCls => {
        if (processed.has(otherCls.id)) return;
        
        const otherStart = timeToMinutes(otherCls.start_time);
        const otherEnd = timeToMinutes(otherCls.end_time);
        
        // Check if classes overlap
        if (clsStart < otherEnd && clsEnd > otherStart) {
          group.push(otherCls);
          processed.add(otherCls.id);
        }
      });
      
      groups.push(group);
    });
    
    return groups;
  };

  // Get classes for each visible day
  const getClassesForDay = (dayValue: number): ClassPosition[] => {
    const dayClasses = classes
      .filter(cls => cls.day_of_week === dayValue)
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    
    const overlapGroups = findOverlappingClasses(dayClasses);
    const positions: ClassPosition[] = [];
    
    overlapGroups.forEach(group => {
      group.forEach(cls => {
        const position = calculateClassPosition(cls, group);
        positions.push(position);
      });
    });
    
    return positions;
  };

  const getSubjectDisplay = (classItem: Tables<'classes'>): string => {
    if (!classSubjects || !classItem.subject_id) {
      return '-';
    }
    const subject = classSubjects[classItem.id];
    if (subject) {
      return formatSubjectDisplay(subject);
    }
    return '-';
  };

  // Get color for class based on subject
  const getClassColor = (classItem: Tables<'classes'>): string => {
    if (!classSubjects || !classItem.subject_id) {
      // Default color for classes without subjects
      return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600';
    }
    
    const subject = classSubjects[classItem.id];
    if (subject) {
      // Use discipline color first, fallback to curriculum color
      if (subject.discipline) {
        const disciplineColor = getSubjectDisciplineColor(subject.discipline);
        return `${disciplineColor} border-2 dark:bg-opacity-80`;
      } else if (subject.curriculum) {
        const curriculumColor = getSubjectCurriculumColor(subject.curriculum);
        return `${curriculumColor} border-2 dark:bg-opacity-80`;
      }
    }
    
    // Default color
    return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600';
  };

  

  if (activeDays.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No classes found for the selected filters</p>
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
              {activeDays.map((day, dayIndex) => (
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
                          key={position.class.id}
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
                          onClick={() => onClassClick(position.class)}
                        >
                          {/* Subject */}
                          <div className="font-semibold truncate text-xs leading-tight">
                            {getSubjectDisplay(position.class)}
                          </div>
                          
                          {/* Additional details placeholder (was level) */}
                          
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
                          
                          {/* Student count (if space allows) */}
                          {classStudents && classStudents[position.class.id]?.length > 0 && position.height > 60 && (
                            <div className="text-xs opacity-75 truncate leading-tight">
                              {classStudents[position.class.id].length} student{classStudents[position.class.id].length !== 1 ? 's' : ''}
                            </div>
                          )}
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