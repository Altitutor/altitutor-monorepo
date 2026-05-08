/**
 * QuickBooks Export API
 * 
 * Fetches tutor logs data formatted for QuickBooks CSV export
 */

import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TutorLogExportData } from '../utils/quickbooks-export.processor';

/**
 * Fetch tutor logs for QuickBooks export
 * Returns all tutor logs within the date range with all required relationships
 */
export async function fetchTutorLogsForExport(params: {
  startDate: string; // YYYY-MM-DD (Adelaide timezone)
  endDate: string; // YYYY-MM-DD (Adelaide timezone)
  /** When set, narrows RPC results to logs for sessions where this staff is on the session (server-side). */
  staffIdForRpc?: string;
}): Promise<TutorLogExportData[]> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  try {
    // Use the existing search function to get tutor logs
    // This already filters by session date in Adelaide timezone
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_tutor_logs_admin', {
      p_search: undefined,
      p_range_start: params.startDate,
      p_range_end: params.endDate,
      p_staff_id: params.staffIdForRpc,
      p_limit: 10000, // Large limit to get all records
      p_offset: 0,
      p_order_by: 'session_start_at',
      p_ascending: true,
    });
    
    if (rpcError) throw rpcError;
    if (!rpcResult) {
      return [];
    }
    
    type TutorLogRow = { id: string; session_id: string };
    type SessionRow = {
      id: string;
      start_at?: string;
      end_at?: string;
      type?: string;
      class_id?: string | null;
    };
    type StaffAttendanceRow = { staff_id: string; type?: string; attended?: boolean };
    type StudentAttendanceRow = { student_id: string; attended?: boolean };
    const rpcData = rpcResult as {
      tutorLogs: TutorLogRow[];
      sessions: Record<string, SessionRow>;
      staffAttendance: Record<string, StaffAttendanceRow[]>;
      studentAttendance: Record<string, StudentAttendanceRow[]>;
      classesById: Record<string, { id: string; subject_id?: string }>;
      subjectsById: Record<string, { id: string; name?: string; long_name?: string }>;
      total: number;
    };
    
    const tutorLogs = rpcData.tutorLogs || [];
    const sessions = rpcData.sessions || {};
    const staffAttendance = rpcData.staffAttendance || {};
    const studentAttendance = rpcData.studentAttendance || {};
    const classesById = rpcData.classesById || {};
    const subjectsById = rpcData.subjectsById || {};
    
    // Fetch staff details for all staff members in attendance
    const staffIds = new Set<string>();
    for (const attendance of Object.values(staffAttendance)) {
      for (const att of attendance) {
        staffIds.add(att.staff_id);
      }
    }
    
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id, first_name, last_name')
      .in('id', Array.from(staffIds));
    
    if (staffError) throw staffError;
    
    const staffById = new Map(
      (staffData || []).map((s) => [s.id, s])
    );
    
    // Transform data into TutorLogExportData format
    const exportData: TutorLogExportData[] = [];
    
    for (const tutorLog of tutorLogs) {
      const session = sessions[tutorLog.session_id];
      if (!session) continue;
      
      const staffAtt = staffAttendance[tutorLog.id] || [];
      const studentAtt = studentAttendance[tutorLog.id] || [];
      
      // Count attended students
      const attendedStudentCount = studentAtt.filter((s) => s.attended).length;
      
      // Get subject information
      // ADMIN_SHIFT / ADMIN_MEETING sessions don't have classes/subjects, so handle that case
      let subjectName: string | null = null;
      let subjectLongName: string | null = null;
      let subjectId: string | null = null;
      const classId = session.class_id ?? null;

      if (session.type !== 'ADMIN_SHIFT' && session.type !== 'ADMIN_MEETING' && session.class_id && classesById[session.class_id]) {
        const classData = classesById[session.class_id];
        if (classData.subject_id && subjectsById[classData.subject_id]) {
          const subject = subjectsById[classData.subject_id];
          subjectId = classData.subject_id;
          subjectName = subject.name || null;
          subjectLongName = subject.long_name || subject.name || null;
        }
      }
      
      // Create an entry for each staff member who attended
      for (const att of staffAtt) {
        // Only include staff with attended = TRUE
        if (!att.attended) continue;
        
        const staff = staffById.get(att.staff_id);
        if (!staff) continue;
        
        exportData.push({
          tutorLogId: tutorLog.id,
          sessionId: session.id,
          sessionType: (session.type ?? 'CLASS') as 'CLASS' | 'EXAM_COURSE' | 'DRAFTING' | 'SUBSIDY_INTERVIEW' | 'TRIAL_SESSION' | 'STAFF_INTERVIEW' | 'ADMIN_SHIFT' | 'ADMIN_MEETING',
          sessionStartAt: session.start_at || '',
          sessionEndAt: session.end_at || '',
          classId,
          subjectId,
          staffId: att.staff_id,
          staffFirstName: staff.first_name,
          staffLastName: staff.last_name,
          staffAttendanceType: att.type as 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR' | null,
          subjectName,
          subjectLongName,
          attendedStudentCount,
        });
      }
    }
    
    return exportData;
  } catch (error) {
    console.error('Error fetching tutor logs for export:', error);
    throw error;
  }
}
