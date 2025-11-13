'use client';

import { useState, useMemo } from 'react';
import { Card, Button, Input } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { formatSubjectDisplay, formatSubjectShortName } from '@/shared/utils/index';
import { getSubjectColorHex, getSubjectColorStyle } from '@/shared/utils';
import { ClassCard } from '@/shared/components/ClassCard';
import { Search } from 'lucide-react';

interface CalendarViewProps {
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

export function CalendarView({ 
  classes, 
  classSubjects, 
  classStudents, 
  classStaff, 
  onClassClick 
}: CalendarViewProps) {
  const [dayFilter, setDayFilter] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const days = [
    { name: 'Monday', value: 1, short: 'Mon' },
    { name: 'Tuesday', value: 2, short: 'Tue' },
    { name: 'Wednesday', value: 3, short: 'Wed' },
    { name: 'Thursday', value: 4, short: 'Thu' },
    { name: 'Friday', value: 5, short: 'Fri' },
    { name: 'Saturday', value: 6, short: 'Sat' },
    { name: 'Sunday', value: 0, short: 'Sun' },
  ];

  // Filter classes based on search term and day filter
  const filteredClasses = useMemo(() => {
    let result = [...classes];
    
    // Helper function to get subject display name
    const getSubjectDisplay = (classItem: Tables<'classes'>): string => {
      const subject = classSubjects?.[classItem.id];
      if (subject) {
        return formatSubjectDisplay(subject);
      }
      return '-';
    };
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(cls => {
        const subject = classSubjects?.[cls.id];
        
        // Search in subject short name
        const subjectShortName = subject ? formatSubjectShortName(subject).toLowerCase() : '';
        const subjectShortMatch = subjectShortName.includes(searchLower);
        
        // Search in subject long name (display name)
        const subjectDisplay = getSubjectDisplay(cls).toLowerCase();
        const subjectLongMatch = subjectDisplay.includes(searchLower);
        
        // Search in student names (concatenated first_name + last_name)
        const students = classStudents?.[cls.id] || [];
        const studentMatch = students.some(student => {
          const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim().toLowerCase();
          return fullName.includes(searchLower) ||
            (student.first_name || '').toLowerCase().includes(searchLower) ||
            (student.last_name || '').toLowerCase().includes(searchLower);
        });
        
        // Search in staff names (concatenated first_name + last_name)
        const staff = classStaff?.[cls.id] || [];
        const staffMatch = staff.some(staffMember => {
          const fullName = `${staffMember.first_name || ''} ${staffMember.last_name || ''}`.trim().toLowerCase();
          return fullName.includes(searchLower) ||
            (staffMember.first_name || '').toLowerCase().includes(searchLower) ||
            (staffMember.last_name || '').toLowerCase().includes(searchLower);
        });
        
        return subjectShortMatch || subjectLongMatch || studentMatch || staffMatch;
      });
    }
    
    // Apply day filter (multi-select)
    if (dayFilter.length > 0) {
      result = result.filter(cls => dayFilter.includes(cls.day_of_week));
    }
    
    return result;
  }, [classes, searchTerm, dayFilter, classSubjects, classStudents, classStaff]);

  // Filter days that have classes (from filtered classes)
  const activeDays = days.filter(day => 
    filteredClasses.some(cls => cls.day_of_week === day.value)
  );

  // Day filter toggle function
  const toggleDay = (day: number) => {
    setDayFilter(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  const clearDayFilter = () => {
    setDayFilter([]);
  };

  // Convert time string to minutes from start of day
  const timeToMinutes = (timeString: string): number => {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Calculate dynamic time range based on filtered classes
  const calculateTimeRange = (): { startHour: number; endHour: number } => {
    if (filteredClasses.length === 0) {
      // Default to 9am-8pm if no classes
      return { startHour: 9, endHour: 20 };
    }

    let earliestStartMinutes = Infinity;
    let latestEndMinutes = -Infinity;

    filteredClasses.forEach(cls => {
      const startMinutes = timeToMinutes(cls.start_time);
      const endMinutes = timeToMinutes(cls.end_time);
      
      earliestStartMinutes = Math.min(earliestStartMinutes, startMinutes);
      latestEndMinutes = Math.max(latestEndMinutes, endMinutes);
    });

    // Add 1 hour buffer before earliest start and after latest end
    const startHour = Math.max(0, Math.floor(earliestStartMinutes / 60) - 1);
    // Add 60 minutes (1 hour) to latest end time, then convert to hours
    // Use Math.floor to get the hour slot that contains the end time + 1 hour
    // Example: class ends at 7:15 PM → 7:15 + 1hr = 8:15 PM → hour slot = 8:00 PM
    const endHourWithBuffer = latestEndMinutes + 60;
    const endHour = Math.min(23, Math.floor(endHourWithBuffer / 60));

    return { startHour, endHour };
  };

  const { startHour, endHour } = calculateTimeRange();

  // Generate time slots dynamically based on class times
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const label = `${displayHour}:00 ${ampm}`;
      const value = `${hour.toString().padStart(2, '0')}:00`;
      
      slots.push({ hour, minute: 0, label, value });
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Calculate position of a class block relative to the calendar grid
  const calculateClassPosition = (
    cls: Tables<'classes'>, 
    overlappingClasses: Tables<'classes'>[]
  ): ClassPosition => {
    const startMinutes = timeToMinutes(cls.start_time);
    const endMinutes = timeToMinutes(cls.end_time);
    const duration = endMinutes - startMinutes;
    
    // Position from dynamic start hour - each hour slot is 75px
    const calendarStartMinutes = startHour * 60;
    const minutesFromCalendarStart = startMinutes - calendarStartMinutes;
    const slotHeight = 75; // pixels per hour slot
    
    // Calculate position in the grid
    const top = Math.max(0, (minutesFromCalendarStart / 60) * slotHeight);
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
    const dayClasses = filteredClasses
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


  // Get color for class based on subject (unused but kept for potential future use)
  const _getClassColor = (classItem: Tables<'classes'>): { className: string; style: React.CSSProperties } => {
    if (!classSubjects || !classItem.subject_id) {
      // Default color for classes without subjects
      return { className: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600', style: {} };
    }
    
    const subject = classSubjects[classItem.id];
    if (subject) {
      const subjectColorHex = getSubjectColorHex(subject);
      const { textColorClass } = getSubjectColorStyle(subject);
      if (subjectColorHex) {
        return {
          className: `${textColorClass} border-2 dark:bg-opacity-80`,
          style: { backgroundColor: subjectColorHex, borderColor: subjectColorHex }
        };
      }
    }
    
    // Default color
    return { className: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600', style: {} };
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
    <div className="flex flex-col h-full space-y-4">
      {/* Search and Day Filter */}
      <div className="flex items-center gap-4">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by subject, student, or staff..."
            className="pl-8"
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-1">
        <Button 
          variant={dayFilter.includes(1) ? 'default' : 'outline'} 
          size="sm"
          onClick={() => toggleDay(1)}
        >
          Mon
        </Button>
        <Button 
          variant={dayFilter.includes(2) ? 'default' : 'outline'} 
          size="sm"
          onClick={() => toggleDay(2)}
        >
          Tue
        </Button>
        <Button 
          variant={dayFilter.includes(3) ? 'default' : 'outline'} 
          size="sm"
          onClick={() => toggleDay(3)}
        >
          Wed
        </Button>
        <Button 
          variant={dayFilter.includes(4) ? 'default' : 'outline'} 
          size="sm"
          onClick={() => toggleDay(4)}
        >
          Thu
        </Button>
        <Button 
          variant={dayFilter.includes(5) ? 'default' : 'outline'} 
          size="sm"
          onClick={() => toggleDay(5)}
        >
          Fri
        </Button>
        <Button 
          variant={dayFilter.includes(6) ? 'default' : 'outline'} 
          size="sm"
          onClick={() => toggleDay(6)}
        >
          Sat
        </Button>
        <Button 
          variant={dayFilter.includes(0) ? 'default' : 'outline'} 
          size="sm"
          onClick={() => toggleDay(0)}
        >
          Sun
        </Button>
        {dayFilter.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={clearDayFilter}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        )}
        </div>
      </div>

      {/* Calendar Grid */}
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
              <div className="sticky left-0 z-10 p-2 text-sm bg-muted/30 border-b border-r text-center font-medium h-[75px] flex items-center justify-center">
                {timeSlot.label}
              </div>
              
              {/* Day columns */}
              {activeDays.map((day, _dayIndex) => (
                <div 
                  key={`${day.value}-${timeSlot.value}`} 
                  className="relative border-b border-r bg-background h-[75px]"
                  style={{
                    position: 'relative'
                  }}
                >
                  {/* Only render classes in the first time slot to avoid duplicates */}
                  {timeIndex === 0 && (
                    <div className="absolute inset-0" style={{ height: `${timeSlots.length * 75}px` }}>
                      {getClassesForDay(day.value).map((position) => {
                        const classStudentsList = classStudents?.[position.class.id] || [];
                        const classStaffList = classStaff?.[position.class.id] || [];
                        const classSubject = classSubjects?.[position.class.id];
                        
                        // Calculate actual pixel dimensions for smart sizing
                        // Width is percentage of parent, need to estimate based on column width
                        // For simplicity, we'll use the height and estimate width
                        const cardHeight = Math.max(position.height, 45);
                        // Estimate width: assume column is ~200-300px wide, calculate from percentage
                        const estimatedColumnWidth = 250; // Approximate column width
                        const cardWidth = (position.width / 100) * estimatedColumnWidth;
                        
                        return (
                          <div
                            key={position.class.id}
                            className="absolute"
                            style={{
                              top: `${position.top}px`,
                              height: `${cardHeight}px`,
                              left: `${position.left}%`,
                              width: `${position.width}%`,
                              zIndex: 15,
                              minHeight: '45px'
                            }}
                            onClick={() => onClassClick(position.class)}
                          >
                            <ClassCard
                              class={position.class}
                              subject={classSubject}
                              staff={classStaffList}
                              students={classStudentsList}
                              onClick={() => {}}
                              isCalendarView={true}
                              cardHeight={cardHeight}
                              cardWidth={cardWidth}
                            />
                          </div>
                        );
                      })}
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

