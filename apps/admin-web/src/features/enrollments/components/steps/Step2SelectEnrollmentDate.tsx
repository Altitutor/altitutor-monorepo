'use client';

import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { formatDate, cn } from '@/shared/utils';
import { calculateFirstSessionDate } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { EnrollmentContext } from '../../types/enrollment';
import { EnrollmentWeekCalendar } from '../EnrollmentWeekCalendar';

interface Step2SelectEnrollmentDateProps {
  context: EnrollmentContext;
  enrollmentDate: string;
  onDateChange: (date: string) => void;
  studentId: string | null;
  selectedStudent?: Tables<'students'>;
  
  // Class context props
  classData?: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  
  // Student context props
  selectedClass?: ClassWithExpandedSubject;
}

export function Step2SelectEnrollmentDate({
  context,
  enrollmentDate,
  onDateChange,
  studentId,
  selectedStudent,
  classData,
  classSubject,
  classStaff,
  selectedClass,
}: Step2SelectEnrollmentDateProps) {
  // Get the class data
  const classForValidation = useMemo(() => {
    if (context === 'student') {
      return selectedClass;
    } else {
      return classData && classSubject
        ? { ...classData, subject: classSubject } as ClassWithExpandedSubject
        : undefined;
    }
  }, [context, selectedClass, classData, classSubject]);

  // Generate list of future session dates (next 16 weeks worth)
  const futureSessionDates = useMemo(() => {
    if (!classForValidation || classForValidation.day_of_week === null || classForValidation.day_of_week === undefined) {
      return [];
    }

    const today = getMidnightAdelaide(new Date());
    const firstSession = calculateFirstSessionDate(
      {
        day_of_week: classForValidation.day_of_week,
        start_time: classForValidation.start_time || '09:00',
      },
      today
    );

    const dates: Array<{ value: string; label: string }> = [];
    const currentDate = new Date(firstSession);
    
    // Generate dates for the next 16 weeks (16 sessions)
    for (let i = 0; i < 16; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const formattedDate = formatDate(currentDate);
      dates.push({
        value: dateStr,
        label: formattedDate,
      });
      
      // Move to next week (add 7 days)
      currentDate.setDate(currentDate.getDate() + 7);
    }

    return dates;
  }, [classForValidation]);

  // Get student name for info card
  const studentName = selectedStudent
    ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
    : 'choose student';

  // Get class name for info card
  const className = context === 'student'
    ? (selectedClass
        ? (selectedClass.long_name?.trim() ?? '')
        : 'choose class')
    : (classData && classSubject
        ? (classData.long_name?.trim() ?? '')
        : 'choose class');

  const isStudentChosen = studentName !== 'choose student';
  const isClassChosen = className !== 'choose class';
  const isDateChosen = !!enrollmentDate && enrollmentDate.trim() !== '' && futureSessionDates.length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* Info Card */}
      <div className="mb-4 p-4 bg-muted rounded-lg space-y-3">
        <p className="text-sm font-medium">
          Enroll{' '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            isStudentChosen
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
          )}>
            {studentName}
          </span>{' '}
          in{' '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            isClassChosen
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
          )}>
            {className}
          </span>{' '}
          starting on{' '}
          <span className="inline-flex items-center">
            {futureSessionDates.length > 0 ? (
              <Select
                value={enrollmentDate || undefined}
                onValueChange={onDateChange}
              >
                <SelectTrigger className={cn(
                  "h-8 text-sm font-semibold border focus:ring-primary/20 w-auto min-w-[180px]",
                  isDateChosen
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
                )}>
                  <SelectValue placeholder="Select session date" />
                </SelectTrigger>
                <SelectContent>
                  {futureSessionDates.map((date) => (
                    <SelectItem key={date.value} value={date.value}>
                      {date.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="px-2 py-1 rounded-md bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/20 text-sm font-semibold">
                choose class
              </span>
            )}
          </span>
        </p>
        {classForValidation && futureSessionDates.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Student will be added to all sessions on or after this date
          </p>
        )}
      </div>

      {/* Week Calendar View - show if classData exists (class context) or studentId exists (student context) */}
      {(classData || studentId) && (
        <div className="mt-4">
          <EnrollmentWeekCalendar
            studentId={studentId}
            selectedStudent={selectedStudent}
            enrollmentDate={enrollmentDate}
            selectedClass={context === 'student' ? selectedClass : undefined}
            classData={context === 'class' ? classData : undefined}
            classStaff={context === 'class' ? classStaff : undefined}
            onEnrollmentDateChange={onDateChange}
          />
        </div>
      )}
    </div>
  );
}

