'use client';

import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Calendar as CalendarIcon } from 'lucide-react';
import { StudentCard } from '@/shared/components/StudentCard';
import { ClassCard } from '@/shared/components/ClassCard';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { EnrollmentContext, StudentWithEnrollmentInfo } from '../../types/enrollment';

interface Step2SelectEnrollmentDateProps {
  context: EnrollmentContext;
  enrollmentDate: string;
  onDateChange: (date: string) => void;
  
  // Class context props
  classData?: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  selectedStudent?: StudentWithEnrollmentInfo | Tables<'students'>;
  
  // Student context props
  student?: Tables<'students'>;
  studentSubjects?: Tables<'subjects'>[];
  selectedClass?: ClassWithExpandedSubject;
}

export function Step2SelectEnrollmentDate({
  context,
  enrollmentDate,
  onDateChange,
  classData,
  classSubject,
  classStaff,
  selectedStudent,
  student,
  studentSubjects,
  selectedClass,
}: Step2SelectEnrollmentDateProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* Show student card for class context */}
      {context === 'class' && selectedStudent && (
        <div className="mb-2">
          <StudentCard
            student={selectedStudent as Tables<'students'>}
            subjects={('subjects' in selectedStudent ? (selectedStudent as any).subjects : []) || []}
            showSubjects={true}
          />
        </div>
      )}
      
      {/* Show student card for student context */}
      {context === 'student' && student && (
        <div className="mb-2">
          <StudentCard
            student={student}
            subjects={studentSubjects || []}
            showSubjects={true}
          />
        </div>
      )}
      
      {/* Show class card for student context */}
      {context === 'student' && selectedClass && (
        <div className="mb-2">
          <ClassCard
            class={selectedClass}
            subject={selectedClass.subject}
            staff={selectedClass.staff || []}
            students={selectedClass.students || []}
          />
        </div>
      )}
      
      {/* Show class card for class context */}
      {context === 'class' && classData && classSubject && (
        <div className="mb-2">
          <ClassCard
            class={classData}
            subject={classSubject}
            staff={classStaff || []}
            students={[]}
          />
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
    </div>
  );
}

