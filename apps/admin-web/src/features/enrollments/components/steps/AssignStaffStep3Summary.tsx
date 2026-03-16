'use client';

import { Alert, AlertDescription } from '@altitutor/ui';
import { AlertTriangle } from 'lucide-react';
import { getDayOfWeek } from '@/shared/utils/datetime';
import { formatDate, cn } from '@/shared/utils';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { AssignStaffContext, StaffConflictInfo, ClassConflictInfo, StaffUnavailabilityInfo } from '../../types/enrollment';

function staffDisplayName(s: Tables<'staff'>): string {
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Staff';
}

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
  staffSubjects: _staffSubjects,
  classData,
  classSubject,
  classStaff: _classStaff,
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

  const staffLabel = context === 'staff'
    ? (staff ? staffDisplayName(staff) : '—')
    : (selectedStaff && selectedStaff.length > 0
        ? selectedStaff.map(s => staffDisplayName(s)).join(', ')
        : '—');

  const className = context === 'class' && classData && classSubject
    ? (classData.long_name?.trim() ?? '')
    : (selectedClasses && selectedClasses.length > 0
        ? selectedClasses.map(c => c.long_name?.trim() ?? '').join(', ')
        : '—');

  const dateDisplay = assignmentDate
    ? formatDate(new Date(assignmentDate))
    : '—';

  return (
    <div className="space-y-4">
      {/* Read-only summary card: Assign {staff} to {class} starting on {date} */}
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm font-medium">
          Assign{' '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            "bg-primary/10 text-primary border-primary/20"
          )}>
            {staffLabel}
          </span>{' '}
          to{' '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            "bg-primary/10 text-primary border-primary/20"
          )}>
            {className}
          </span>{' '}
          starting on{' '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            "bg-primary/10 text-primary border-primary/20"
          )}>
            {dateDisplay}
          </span>
        </p>
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

