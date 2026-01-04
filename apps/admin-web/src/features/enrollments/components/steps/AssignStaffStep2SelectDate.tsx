'use client';

import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Calendar as CalendarIcon } from 'lucide-react';
import { StaffCard } from '@/shared/components/StaffCard';
import { ClassCard } from '@/shared/components/ClassCard';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { AssignStaffContext } from '../../types/enrollment';

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
  staffSubjects,
  selectedClasses,
}: AssignStaffStep2SelectDateProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* Show staff card for staff context */}
      {context === 'staff' && staff && (
        <div className="mb-2">
          <StaffCard
            staff={staff}
            subjects={staffSubjects || []}
            showSubjects={true}
          />
        </div>
      )}
      
      {/* Show selected classes for staff context */}
      {context === 'staff' && selectedClasses && selectedClasses.length > 0 && (
        <div className="mb-2 space-y-2">
          {selectedClasses.map(c => (
            <ClassCard
              key={c.id}
              class={c}
              subject={c.subject}
              staff={c.staff || []}
              students={c.students || []}
            />
          ))}
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
      
      {/* Show selected staff for class context */}
      {context === 'class' && selectedStaff && selectedStaff.length > 0 && (
        <div className="mb-2 space-y-2">
          {selectedStaff.map(s => (
            <StaffCard
              key={s.id}
              staff={s}
              subjects={[]}
            />
          ))}
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="assignment-date">Assignment Start Date</Label>
        <div className="relative">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="assignment-date"
            type="date"
            value={assignmentDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Staff will be assigned to all sessions on or after this date
        </p>
      </div>
    </div>
  );
}

