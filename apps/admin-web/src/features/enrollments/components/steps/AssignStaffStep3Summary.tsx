'use client';

import { Alert, AlertDescription } from '@altitutor/ui';
import { AlertTriangle } from 'lucide-react';
import { StaffCard } from '@/shared/components/StaffCard';
import { ClassCard } from '@/shared/components/ClassCard';
import { getDayOfWeek } from '@/shared/utils/datetime';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { AssignStaffContext, StaffConflictInfo, ClassConflictInfo, StaffUnavailabilityInfo } from '../../types/enrollment';

interface AssignStaffStep3SummaryProps {
  context: AssignStaffContext;
  selectedStaff?: Tables<'staff'>[];
  selectedClasses?: ClassWithExpandedSubject[];
  staff?: Tables<'staff'>;
  staffSubjects?: Tables<'subjects'>[];
  classData?: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  assignmentDate: string;
  staffConflicts: Map<string, StaffConflictInfo>;
  classConflicts: Map<string, ClassConflictInfo>;
  staffUnavailability: Map<string, StaffUnavailabilityInfo>;
  classUnavailability: Map<string, StaffUnavailabilityInfo>;
}

export function AssignStaffStep3Summary({
  context,
  selectedStaff,
  selectedClasses,
  staff,
  staffSubjects,
  classData,
  classSubject,
  classStaff,
  assignmentDate,
  staffConflicts,
  classConflicts,
  staffUnavailability,
  classUnavailability,
}: AssignStaffStep3SummaryProps) {
  // Collect all warnings
  const conflictWarnings: string[] = [];
  const unavailabilityWarnings: string[] = [];

  if (context === 'staff' && selectedClasses) {
    selectedClasses.forEach(c => {
      const conflictInfo = staffConflicts.get(c.id);
      const unavailabilityInfo = staffUnavailability.get(c.id);
      
      if (conflictInfo) {
        conflictWarnings.push(
          `Time conflict: ${c.subject?.name || 'Class'} on ${getDayOfWeek(c.day_of_week)} overlaps with another class`
        );
      }
      
      if (unavailabilityInfo) {
        unavailabilityWarnings.push(
          `${unavailabilityInfo.staffName} is unavailable on ${getDayOfWeek(unavailabilityInfo.dayOfWeek)}`
        );
      }
    });
  } else if (context === 'class' && selectedStaff) {
    selectedStaff.forEach(s => {
      const conflictInfo = classConflicts.get(s.id);
      const unavailabilityInfo = classUnavailability.get(s.id);
      
      if (conflictInfo) {
        conflictWarnings.push(
          `${s.first_name} ${s.last_name} has a time conflict with another class`
        );
      }
      
      if (unavailabilityInfo) {
        unavailabilityWarnings.push(
          `${unavailabilityInfo.staffName} is unavailable on ${getDayOfWeek(unavailabilityInfo.dayOfWeek)}`
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {/* Show staff card for staff context */}
        {context === 'staff' && staff && (
          <div>
            <StaffCard
              staff={staff}
              subjects={staffSubjects || []}
              showSubjects={true}
            />
          </div>
        )}

        {/* Show selected classes for staff context */}
        {context === 'staff' && selectedClasses && selectedClasses.length > 0 && (
          <div className="space-y-2">
            {selectedClasses.map(c => (
              <div key={c.id}>
                <ClassCard
                  class={c}
                  subject={c.subject}
                  staff={c.staff || []}
                  students={c.students || []}
                />
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <p className="text-muted-foreground">Start Date: {assignmentDate}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show class card for class context */}
        {context === 'class' && classData && classSubject && (
          <div>
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
          <div className="space-y-2">
            {selectedStaff.map(s => (
              <div key={s.id}>
                <StaffCard
                  staff={s}
                  subjects={[]}
                />
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <p className="text-muted-foreground">Start Date: {assignmentDate}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warnings */}
      {(conflictWarnings.length > 0 || unavailabilityWarnings.length > 0) && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {conflictWarnings.map((warning, i) => (
              <p key={`conflict-${i}`} className="text-sm font-medium text-red-600">{warning}</p>
            ))}
            {unavailabilityWarnings.map((warning, i) => (
              <p key={`unavailable-${i}`} className="text-sm font-medium text-orange-600">{warning}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

