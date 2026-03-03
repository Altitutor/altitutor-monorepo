import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Check if two classes have overlapping time slots
 * Note: 09:00 end / 09:00 start is NOT considered overlapping
 */
export function checkTimeOverlap(
  class1: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'>,
  class2: Pick<Tables<'classes'>, 'day_of_week' | 'start_time' | 'end_time'>
): boolean {
  // Must be on the same day
  if (class1.day_of_week !== class2.day_of_week) {
    return false;
  }
  
  // Parse times to comparable format (minutes from midnight)
  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  const start1 = parseTime(class1.start_time);
  const end1 = parseTime(class1.end_time);
  const start2 = parseTime(class2.start_time);
  const end2 = parseTime(class2.end_time);
  
  // Check for overlap: start1 < end2 AND start2 < end1
  // This correctly handles the case where end of one = start of another (no overlap)
  return start1 < end2 && start2 < end1;
}

/**
 * Get enrollment conflicts for a student enrolling in a class
 * @returns Object with same subject warning and time overlap warnings
 */
export async function getEnrollmentConflicts(
  studentId: string,
  classId: string,
  _enrollmentDate: Date
): Promise<{
  sameSubjectWarning: string | null;
  timeOverlapWarnings: string[];
}> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  try {
    // Get the target class details
    const { data: targetClass, error: targetError } = await supabase
      .from('classes')
      .select(`
        *,
        subject:subjects(*)
      `)
      .eq('id', classId)
      .single();
    
    if (targetError) throw targetError;
    if (!targetClass) {
      return { sameSubjectWarning: null, timeOverlapWarnings: [] };
    }
    
    // Get student's current and future enrollments with class details
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('classes_students')
      .select(`
        *,
        class:classes(
          *,
          subject:subjects(*)
        )
      `)
      .eq('student_id', studentId)
      .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`)
      .neq('class_id', classId); // Exclude the target class itself
    
    if (enrollmentsError) throw enrollmentsError;
    
    let sameSubjectWarning: string | null = null;
    const timeOverlapWarnings: string[] = [];
    
    type ClassWithSubject = (Tables<'classes'> & { subject: { name?: string } | null }) | null;

    // Check each enrollment for conflicts
    for (const enrollment of enrollments || []) {
      const enrolledClass = enrollment.class as ClassWithSubject;
      if (!enrolledClass) continue;
      
      // Check for same subject
      if (enrolledClass.subject_id === targetClass.subject_id) {
        const subjectName = enrolledClass.subject?.name || 'this subject';
        sameSubjectWarning = `Student is already enrolled in another ${subjectName} class`;
      }
      
      // Check for time overlap
      if (checkTimeOverlap(targetClass, enrolledClass)) {
        const subjectName = enrolledClass.subject?.name || 'Unknown';
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[enrolledClass.day_of_week];
        timeOverlapWarnings.push(
          `Time conflict with ${subjectName} class on ${dayName} (${enrolledClass.start_time}-${enrolledClass.end_time})`
        );
      }
    }
    
    return { sameSubjectWarning, timeOverlapWarnings };
  } catch (error) {
    console.error('Error checking enrollment conflicts:', error);
    return { sameSubjectWarning: null, timeOverlapWarnings: [] };
  }
}

/**
 * Validate that a date is today or in the future
 */
export function isDateTodayOrFuture(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate >= today;
}

/**
 * Get midnight in Adelaide timezone for a given date
 */
export function getMidnightAdelaide(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  const midnight = new Date(year, month, day, 0, 0, 0, 0);
  return midnight;
}

