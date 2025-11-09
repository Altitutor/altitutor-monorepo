import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get students by subject ID
 */
export async function getStudentsBySubject(subjectId: string): Promise<Tables<'students'>[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  const { data, error } = await supabase
    .from('students_subjects')
    .select('student:students(*)')
    .eq('subject_id', subjectId);
  
  if (error) throw error;
  
  return ((data || []) as any[])
    .map((item: any) => item.student)
    .filter(Boolean) as Tables<'students'>[];
}

/**
 * Get students by class ID
 */
export async function getStudentsByClass(classId: string): Promise<Tables<'students'>[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  const { data, error } = await supabase
    .from('classes_students')
    .select('student:students(*)')
    .eq('class_id', classId)
    .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
  
  if (error) throw error;
  
  return ((data || []) as any[])
    .map((item: any) => item.student)
    .filter(Boolean) as Tables<'students'>[];
}

/**
 * Get students by year level
 */
export async function getStudentsByYearLevel(yearLevel: number): Promise<Tables<'students'>[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('year_level', yearLevel)
    .eq('status', 'ACTIVE');
  
  if (error) throw error;
  
  return (data || []) as Tables<'students'>[];
}

/**
 * Get students by session date
 */
export async function getStudentsBySessionDate(date: string): Promise<Tables<'students'>[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  // Query sessions on this date
  const startIso = `${date}T00:00:00Z`;
  const endIso = `${date}T23:59:59Z`;
  
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id')
    .gte('start_at', startIso)
    .lte('start_at', endIso);
  
  if (sessionsError) throw sessionsError;
  
  if (!sessions || sessions.length === 0) {
    return [];
  }
  
  const sessionIds = sessions.map(s => s.id);
  
  // Get all students in these sessions
  const { data: sessionStudents, error: ssError } = await supabase
    .from('sessions_students')
    .select('student:students(*)')
    .in('session_id', sessionIds)
    .eq('planned_absence', false);
  
  if (ssError) throw ssError;
  
  return ((sessionStudents || []) as any[])
    .map((item: any) => item.student)
    .filter(Boolean) as Tables<'students'>[];
}

/**
 * Get student's enrolled classes with subject details
 */
export async function getStudentClasses(studentId: string): Promise<Array<{
  class: Tables<'classes'>;
  subject: Tables<'subjects'> | null;
}>> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  const { data, error } = await supabase
    .from('classes_students')
    .select(`
      class:classes(
        *,
        subject:subjects(*)
      )
    `)
    .eq('student_id', studentId)
    .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
  
  if (error) throw error;
  
  return ((data || []) as any[])
    .map((item: any) => ({
      class: item.class,
      subject: item.class?.subject || null,
    }))
    .filter((item) => item.class) as Array<{
      class: Tables<'classes'>;
      subject: Tables<'subjects'> | null;
    }>;
}

/**
 * Get all subjects (for filter dropdown)
 */
export async function getAllSubjects(): Promise<Tables<'subjects'>[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('curriculum', { ascending: true })
    .order('year_level', { ascending: true })
    .order('name', { ascending: true });
  
  if (error) throw error;
  
  return (data || []) as Tables<'subjects'>[];
}

/**
 * Get all classes (for filter dropdown)
 */
export async function getAllClasses(): Promise<Array<{
  class: Tables<'classes'>;
  subject: Tables<'subjects'> | null;
}>> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  const { data, error } = await supabase
    .from('classes')
    .select(`
      *,
      subject:subjects(*)
    `)
    .eq('status', 'ACTIVE')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });
  
  if (error) throw error;
  
  return ((data || []) as any[]).map((cls: any) => ({
    class: cls,
    subject: cls.subject || null,
  })) as Array<{
    class: Tables<'classes'>;
    subject: Tables<'subjects'> | null;
  }>;
}



