import { useState, useEffect, useRef, useMemo } from 'react';
import type { Tables, ClassWithExpandedSubject, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { checkTimeOverlap } from '@/shared/utils/enrollment';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssignStaffContext, StaffConflictInfo, ClassConflictInfo, StaffUnavailabilityInfo } from '../types/enrollment';

interface UseAssignStaffConflictsProps {
  context: AssignStaffContext;
  step: 1 | 2 | 3;
  selectedStaffId: string | null;
  selectedClassIds: string[]; // For staff context: selected class IDs
  selectedStaffIds: string[]; // For class context: selected staff IDs
  staff?: Tables<'staff'>;
  classData?: Tables<'classes'>;
  classes: ClassWithExpandedSubject[];
  staffList: Tables<'staff'>[];
  assignmentDate: string;
  enabled: boolean;
}

export function useAssignStaffConflicts({
  context,
  step,
  selectedStaffId,
  selectedClassIds,
  selectedStaffIds,
  staff,
  classData,
  classes,
  staffList,
  assignmentDate,
  enabled,
}: UseAssignStaffConflictsProps) {
  const [staffConflicts, setStaffConflicts] = useState<Map<string, StaffConflictInfo>>(new Map());
  const [classConflicts, setClassConflicts] = useState<Map<string, ClassConflictInfo>>(new Map());
  const [staffUnavailability, setStaffUnavailability] = useState<Map<string, StaffUnavailabilityInfo>>(new Map());
  const [classUnavailability, setClassUnavailability] = useState<Map<string, StaffUnavailabilityInfo>>(new Map());
  const prevEnabledRef = useRef(enabled);

  // Create stable references for array IDs to prevent infinite loops
  const classIds = useMemo(() => classes.map(c => c.id).join(','), [classes]);
  const staffIds = useMemo(() => staffList.map(s => s.id).join(','), [staffList]);
  const selectedClassIdsStr = useMemo(() => selectedClassIds.join(','), [selectedClassIds]);
  const selectedStaffIdsStr = useMemo(() => selectedStaffIds.join(','), [selectedStaffIds]);

  useEffect(() => {
    if (!enabled || step !== 1) {
      const wasEnabled = prevEnabledRef.current;
      prevEnabledRef.current = enabled;
      if (wasEnabled) {
        setStaffConflicts(new Map());
        setClassConflicts(new Map());
        setStaffUnavailability(new Map());
        setClassUnavailability(new Map());
      }
      return;
    }

    prevEnabledRef.current = enabled;
    let cancelled = false;

    const checkConflicts = async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;

      try {
        if (context === 'staff' && staff) {
          // Check for overlapping classes for selected staff
          const { data: staffClasses, error: staffClassesError } = await supabase
            .from('classes_staff')
            .select(`
              class:classes(
                id,
                day_of_week,
                start_time,
                end_time,
                subject:subjects(*)
              )
            `)
            .eq('staff_id', staff.id)
            .is('unassigned_at', null);

          if (staffClassesError) throw staffClassesError;
          if (cancelled) return;

          const conflictMap = new Map<string, StaffConflictInfo>();
          const unavailabilityMap = new Map<string, StaffUnavailabilityInfo>();

          // Check each selected class for conflicts
          for (const classId of selectedClassIds) {
            const selectedClass = classes.find(c => c.id === classId);
            if (!selectedClass) continue;

            // Check for time overlap with existing classes
            const conflictingEnrollment = (staffClasses || []).find((sc: any) => {
              const existingClass = sc.class;
              if (!existingClass) return false;
              return checkTimeOverlap(selectedClass, existingClass);
            });

            if (conflictingEnrollment) {
              conflictMap.set(classId, {
                conflictingClass: {
                  id: conflictingEnrollment.class.id,
                  day_of_week: conflictingEnrollment.class.day_of_week,
                  start_time: conflictingEnrollment.class.start_time,
                  end_time: conflictingEnrollment.class.end_time,
                  subject: conflictingEnrollment.class.subject,
                },
              });
            }

            // Check for unavailability on that day
            const dayOfWeek = selectedClass.day_of_week;
            const availabilityField = getAvailabilityField(dayOfWeek, selectedClass.start_time);
            if (availabilityField && !staff[availabilityField]) {
              unavailabilityMap.set(classId, {
                staffName: `${staff.first_name} ${staff.last_name}`,
                dayOfWeek,
              });
            }
          }

          if (!cancelled) {
            setStaffConflicts(conflictMap);
            setStaffUnavailability(unavailabilityMap);
          }
        } else if (context === 'class' && classData) {
          // Check for overlapping classes for selected staff members
          const conflictMap = new Map<string, ClassConflictInfo>();
          const unavailabilityMap = new Map<string, StaffUnavailabilityInfo>();

          for (const staffId of selectedStaffIds) {
            const selectedStaff = staffList.find(s => s.id === staffId);
            if (!selectedStaff) continue;

            // Get staff's existing classes
            const { data: staffClasses, error: staffClassesError } = await supabase
              .from('classes_staff')
              .select(`
                class:classes(
                  id,
                  day_of_week,
                  start_time,
                  end_time
                )
              `)
              .eq('staff_id', staffId)
              .is('unassigned_at', null);

            if (staffClassesError) throw staffClassesError;
            if (cancelled) return;

            // Check for time overlap
            const conflictingEnrollment = (staffClasses || []).find((sc: any) => {
              const existingClass = sc.class;
              if (!existingClass) return false;
              return checkTimeOverlap(classData, existingClass);
            });

            if (conflictingEnrollment) {
              conflictMap.set(staffId, {
                conflictingStaff: {
                  id: selectedStaff.id,
                  first_name: selectedStaff.first_name,
                  last_name: selectedStaff.last_name,
                },
              });
            }

            // Check for unavailability on that day
            const dayOfWeek = classData.day_of_week;
            const availabilityField = getAvailabilityField(dayOfWeek, classData.start_time);
            if (availabilityField && !selectedStaff[availabilityField]) {
              unavailabilityMap.set(staffId, {
                staffName: `${selectedStaff.first_name} ${selectedStaff.last_name}`,
                dayOfWeek,
              });
            }
          }

          if (!cancelled) {
            setClassConflicts(conflictMap);
            setClassUnavailability(unavailabilityMap);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error checking conflicts:', error);
          setStaffConflicts(new Map());
          setClassConflicts(new Map());
          setStaffUnavailability(new Map());
          setClassUnavailability(new Map());
        }
      }
    };

    checkConflicts();

    return () => {
      cancelled = true;
    };
    // Use stable primitives (classIds, staffIds, selectedClassIdsStr, selectedStaffIdsStr, staff?.id, classData?.id)
    // to avoid infinite loops when parent passes new array/object references each render (e.g. class context from ViewClassModal)
  }, [context, step, selectedStaffId, selectedClassIdsStr, selectedStaffIdsStr, staff?.id, classData?.id, classIds, staffIds, assignmentDate, enabled]);

  return {
    staffConflicts,
    classConflicts,
    staffUnavailability,
    classUnavailability,
  };
}

function getAvailabilityField(dayOfWeek: number, startTime?: string): keyof Tables<'staff'> | null {
  switch (dayOfWeek) {
    case 1: return 'availability_monday';
    case 2: return 'availability_tuesday';
    case 3: return 'availability_wednesday';
    case 4: return 'availability_thursday';
    case 5: return 'availability_friday';
    case 6: {
      // Saturday: check AM/PM based on start time
      if (startTime) {
        const hour = parseInt(startTime.split(':')[0]);
        return hour < 12 ? 'availability_saturday_am' : 'availability_saturday_pm';
      }
      return 'availability_saturday_am'; // Default to AM
    }
    case 0: {
      // Sunday: check AM/PM based on start time
      if (startTime) {
        const hour = parseInt(startTime.split(':')[0]);
        return hour < 12 ? 'availability_sunday_am' : 'availability_sunday_pm';
      }
      return 'availability_sunday_am'; // Default to AM
    }
    default: return null;
  }
}

