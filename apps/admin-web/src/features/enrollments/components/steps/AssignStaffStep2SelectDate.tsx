'use client';

import { useMemo, useEffect } from 'react';
import { SearchableSelect } from '@altitutor/ui';
import { formatDate, cn } from '@/shared/utils';
import { calculateFirstSessionDate } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { AssignStaffContext } from '../../types/enrollment';
import { AssignStaffWeekCalendar } from '../AssignStaffWeekCalendar';

function staffDisplayName(s: Tables<'staff'>): string {
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Staff';
}

interface AssignStaffStep2SelectDateProps {
  context: AssignStaffContext;
  assignmentDate: string;
  onDateChange: (date: string) => void;

  // Class context props
  classData?: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  selectedStaff?: Tables<'staff'>[];

  // Staff context props
  staff?: Tables<'staff'>;
  staffSubjects?: Tables<'subjects'>[];
  selectedClasses?: ClassWithExpandedSubject[];
}

export function AssignStaffStep2SelectDate({
  context,
  assignmentDate,
  onDateChange,
  classData,
  classSubject,
  classStaff,
  selectedStaff,
  staff,
  staffSubjects: _staffSubjects,
  selectedClasses,
}: AssignStaffStep2SelectDateProps) {
  // Class(es) for date validation: staff context = first selected class; class context = classData
  const classForDates = useMemo(() => {
    if (context === 'class' && classData && classSubject) {
      return { ...classData, subject: classSubject } as ClassWithExpandedSubject;
    }
    if (context === 'staff' && selectedClasses && selectedClasses.length > 0) {
      return selectedClasses[0];
    }
    return undefined;
  }, [context, classData, classSubject, selectedClasses]);

  // Future session dates (next 16 weeks) for the class
  const futureSessionDates = useMemo(() => {
    if (!classForDates || classForDates.day_of_week === null || classForDates.day_of_week === undefined) {
      return [];
    }

    const today = getMidnightAdelaide(new Date());
    const firstSession = calculateFirstSessionDate(
      {
        day_of_week: classForDates.day_of_week,
        start_time: classForDates.start_time || '09:00',
      },
      today
    );

    const dates: Array<{ value: string; label: string }> = [];
    const currentDate = new Date(firstSession);

    for (let i = 0; i < 16; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const formattedDate = formatDate(currentDate);
      dates.push({
        value: dateStr,
        label: formattedDate,
      });
      currentDate.setDate(currentDate.getDate() + 7);
    }

    return dates;
  }, [classForDates]);

  // Staff display for card
  const staffLabel = context === 'staff'
    ? (staff ? staffDisplayName(staff) : 'choose staff')
    : (selectedStaff && selectedStaff.length > 0
        ? selectedStaff.map(s => staffDisplayName(s)).join(', ')
        : 'choose staff');

  const className = context === 'class' && classData && classSubject
    ? (classData.long_name?.trim() ?? '')
    : (selectedClasses && selectedClasses.length > 0
        ? selectedClasses.map(c => c.long_name?.trim() ?? '').join(', ')
        : 'choose class');

  const isDateChosen = !!assignmentDate && assignmentDate.trim() !== '' && futureSessionDates.length > 0;

  // When future session dates load, set date to first option if current date is not in list
  useEffect(() => {
    if (futureSessionDates.length > 0) {
      const inList = futureSessionDates.some((d) => d.value === assignmentDate);
      if (!assignmentDate || !inList) {
        onDateChange(futureSessionDates[0].value);
      }
    }
  }, [futureSessionDates, assignmentDate, onDateChange]);

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* Info Card: Assign {staff} to {class} starting on {date} */}
      <div className="mb-4 p-4 bg-muted rounded-lg space-y-3">
        <p className="text-sm font-medium flex flex-wrap items-center gap-x-1 gap-y-2">
          Assign{' '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            staffLabel !== 'choose staff'
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
          )}>
            {staffLabel}
          </span>{' '}
          to{' '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            className !== 'choose class'
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
          )}>
            {className}
          </span>{' '}
          starting on{' '}
          <span className="inline-flex items-center">
            {futureSessionDates.length > 0 ? (
              <SearchableSelect<{ value: string; label: string }>
                items={futureSessionDates}
                value={futureSessionDates.find((d) => d.value === assignmentDate) ?? null}
                onValueChange={(item) => item && onDateChange(item.value)}
                getItemLabel={(d) => d.label}
                getItemId={(d) => d.value}
                placeholder="Select session date"
                triggerClassName={cn(
                  "h-8 text-sm font-semibold w-auto min-w-[180px]",
                  isDateChosen
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
                )}
              />
            ) : (
              <span className="px-2 py-1 rounded-md bg-muted-foreground/10 text-muted-foreground border border-muted-foreground/20 text-sm font-semibold">
                choose class
              </span>
            )}
          </span>
        </p>
        {classForDates && futureSessionDates.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Staff will be assigned to all sessions on or after this date
          </p>
        )}
      </div>

      {/* Week Calendar */}
      {(context === 'staff' && staff) || (context === 'class' && classData) ? (
        <div className="mt-4">
          <AssignStaffWeekCalendar
            context={context}
            assignmentDate={assignmentDate}
            onDateChange={onDateChange}
            staffId={context === 'staff' ? staff?.id : undefined}
            staff={context === 'staff' ? staff : undefined}
            selectedClasses={context === 'staff' ? selectedClasses : undefined}
            classData={context === 'class' ? classData : undefined}
            classSubject={context === 'class' ? classSubject : undefined}
            classStaff={context === 'class' ? classStaff : undefined}
            selectedStaff={context === 'class' ? selectedStaff : undefined}
          />
        </div>
      ) : null}
    </div>
  );
}
