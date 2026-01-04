import { useState, useEffect, useRef } from 'react';
import type { Tables, ClassWithExpandedSubject, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { checkTimeOverlap } from '@/shared/utils/enrollment';
import type { SupabaseClient } from '@supabase/supabase-js';

interface UseClassConflictsProps {
  studentId: string | null | undefined;
  classes: ClassWithExpandedSubject[];
  enabled: boolean;
}

export interface ClassConflictInfo {
  conflictingClass: {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    subject?: Tables<'subjects'> | null;
  };
}

// Stable empty map reference to avoid recreating on every render
const EMPTY_MAP = new Map<string, ClassConflictInfo>();

/**
 * Hook to check time conflicts for all classes against a student's existing enrollments
 * Returns a Map of class ID -> conflict info
 */
export function useClassConflicts({
  studentId,
  classes,
  enabled,
}: UseClassConflictsProps): Map<string, ClassConflictInfo> {
  const [conflicts, setConflicts] = useState<Map<string, ClassConflictInfo>>(EMPTY_MAP);
  const prevEnabledRef = useRef(enabled);

  useEffect(() => {
    // Early return if disabled - only update state when transitioning from enabled to disabled
    if (!enabled) {
      const wasEnabled = prevEnabledRef.current;
      prevEnabledRef.current = enabled;
      // Only clear conflicts if transitioning from enabled to disabled
      if (wasEnabled) {
        setConflicts(EMPTY_MAP);
      }
      return;
    }

    // If enabled but missing required data, clear conflicts only if we have conflicts
    if (!studentId || classes.length === 0) {
      prevEnabledRef.current = enabled;
      setConflicts(prev => prev.size > 0 ? EMPTY_MAP : prev);
      return;
    }
    
    prevEnabledRef.current = enabled;

    let cancelled = false;

    const checkConflicts = async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      try {
        // Get student's current and future enrollments with class details including subject
        const { data: enrollments, error: enrollmentsError } = await supabase
          .from('classes_students')
          .select(`
            class:classes(
              id,
              day_of_week,
              start_time,
              end_time,
              subject:subjects(*)
            )
          `)
          .eq('student_id', studentId)
          .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
        
        if (enrollmentsError) throw enrollmentsError;
        if (cancelled) return;

        const enrolledClasses: Array<{ class: Tables<'classes'>; subject?: Tables<'subjects'> | null | undefined }> = [];
        
        for (const enrollment of enrollments || []) {
          const classData = enrollment.class as any;
          if (classData) {
            enrolledClasses.push({
              class: classData as Tables<'classes'>,
              subject: classData.subject as Tables<'subjects'> | null | undefined,
            });
          }
        }

        // Check each class in the list for conflicts
        const conflictMap = new Map<string, ClassConflictInfo>();
        
        for (const classItem of classes) {
          // Find the first conflicting enrolled class
          const conflictingEnrollment = enrolledClasses.find(enrolled => 
            checkTimeOverlap(classItem, enrolled.class)
          );
          
          if (conflictingEnrollment) {
            conflictMap.set(classItem.id, {
              conflictingClass: {
                id: conflictingEnrollment.class.id,
                day_of_week: conflictingEnrollment.class.day_of_week,
                start_time: conflictingEnrollment.class.start_time,
                end_time: conflictingEnrollment.class.end_time,
                subject: conflictingEnrollment.subject,
              },
            });
          }
        }

        if (!cancelled) {
          setConflicts(conflictMap);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error checking class conflicts:', error);
          setConflicts(EMPTY_MAP);
        }
      }
    };

    checkConflicts();

    return () => {
      cancelled = true;
    };
  }, [studentId, classes, enabled]);

  return conflicts;
}

