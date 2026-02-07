'use client';

import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Calendar as CalendarIcon } from 'lucide-react';
import { StudentCard } from '@/shared/components/StudentCard';
import { ClassCard } from '@/shared/components/ClassCard';
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
  // Determine which class to show in calendar - use classData for 'class' context, selectedClass for 'student' context
  const classForCalendar = context === 'class' ? classData : selectedClass;
  
  // Determine which student and class to show
  // In both contexts, show selectedStudent (from step 1) and the class
  const studentToShow = selectedStudent;
  const classToShow = context === 'student' 
    ? selectedClass 
    : (classData ? { ...classData, subject: classSubject, staff: classStaff || [], students: [] } as ClassWithExpandedSubject : undefined);
  const studentSubject = context === 'student' && selectedClass?.subject 
    ? [selectedClass.subject] 
    : context === 'class' && classSubject 
    ? [classSubject] 
    : [];

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* Show student and class cards inline */}
      {(studentToShow || classToShow) && (
        <div className="flex gap-3 mb-4 flex-shrink-0 items-stretch">
          {studentToShow && (
            <div className="w-1/2 flex">
              <StudentCard
                student={studentToShow}
                subjects={studentSubject}
                showSubjects={true}
                showActions={false}
              />
            </div>
          )}
          
          {classToShow && (
            <div className={studentToShow ? "w-1/2 flex" : "w-full flex"}>
              <ClassCard
                class={classToShow}
                subject={classToShow.subject}
                staff={classToShow.staff || []}
                students={classToShow.students || []}
                hideActions={true}
              />
            </div>
          )}
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="enrollment-date">Enrollment Start Date</Label>
        <div className="relative">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="enrollment-date"
            type="date"
            value={enrollmentDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Student will be added to all sessions on or after this date
        </p>
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

