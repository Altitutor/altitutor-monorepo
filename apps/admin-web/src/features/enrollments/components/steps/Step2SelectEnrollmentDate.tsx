'use client';

import { useMemo } from 'react';
import { SearchableSelect } from '@altitutor/ui';
import { formatDate, cn } from '@/shared/utils';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import { useSessionsWithDetails } from '@/features/sessions/hooks/useSessionsQuery';
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

  const today = getMidnightAdelaide(new Date());
  const rangeStart = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(today);
  const classId = classForValidation?.id;
  const { data: classSessionsData, isLoading: isLoadingClassSessions } = useSessionsWithDetails({
    classId,
    rangeStart,
    rangeEnd: classForValidation?.session_end_date ?? undefined,
    includeInactive: false,
    orderBy: 'start_at',
    ascending: true,
  }, { enabled: !!classId });

  // Use the generated Sessions so multi-day and fortnightly Classes are represented accurately.
  const futureSessionDates = useMemo(() => {
    const seenDates = new Set<string>();
    const dates: Array<{ value: string; label: string }> = [];
    for (const session of classSessionsData?.sessions ?? []) {
      if (!session.start_at) continue;
      const sessionDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date(session.start_at));
      if (seenDates.has(sessionDate)) continue;
      seenDates.add(sessionDate);
      dates.push({ value: sessionDate, label: formatDate(new Date(`${sessionDate}T12:00:00`)) });
    }
    return dates;
  }, [classSessionsData?.sessions]);

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
            {isLoadingClassSessions ? (
              <span className="px-2 py-1 text-sm text-muted-foreground">Loading Sessions…</span>
            ) : futureSessionDates.length > 0 ? (
              <SearchableSelect<{ value: string; label: string }>
                items={futureSessionDates}
                value={
                  enrollmentDate
                    ? futureSessionDates.find((d) => d.value === enrollmentDate) ?? null
                    : null
                }
                onValueChange={(item) => onDateChange(item?.value ?? '')}
                getItemLabel={(d) => d.label}
                getItemId={(d) => d.value}
                placeholder="Select session date"
                triggerClassName={cn(
                  'h-8 text-sm font-semibold border focus:ring-primary/20 w-auto min-w-[180px]',
                  isDateChosen
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20'
                )}
              />
            ) : (
              <span className="px-2 py-1 rounded-md bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/20 text-sm font-semibold">
                {classForValidation ? 'No future Sessions' : 'choose class'}
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
