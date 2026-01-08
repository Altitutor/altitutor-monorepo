'use client';

import { useState, useEffect } from 'react';
import { SessionsCard } from '@/features/sessions/components/SessionsCard';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { cn } from '@/shared/utils/index';
import type { Tables, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

type Step1SessionPickerProps = {
  staffId: string;
  selectedSessionId?: string;
  onSelectSession: (sessionId: string) => void;
};

export function Step1SessionPicker({
  staffId,
  selectedSessionId,
  onSelectSession,
}: Step1SessionPickerProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionStudents, setSessionStudents] = useState<Record<string, any[]>>({});
  const [sessionStaff, setSessionStaff] = useState<Record<string, any[]>>({});
  const [classesById, setClassesById] = useState<Record<string, Tables<'classes'>>>({});
  const [subjectsById, setSubjectsById] = useState<Record<string, Tables<'subjects'>>>({});

  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      try {
        const supabase = getSupabaseClient() as SupabaseClient<Database>;
        
        // Get all sessions for this staff using RPC
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        const { data: rpcResult, error: rpcError } = await supabase.rpc('search_sessions_admin', {
          p_search: undefined,
          p_range_start: undefined,
          p_range_end: today.toISOString(),
          p_staff_id: staffId,
          p_class_id: undefined,
          p_student_id: undefined,
          p_statuses: ['ACTIVE'],
          p_types: undefined, // Include all session types
          p_include_relationships: true,
          p_limit: 1000,
          p_offset: 0,
          p_order_by: 'start_at',
          p_ascending: false,
        });

        if (rpcError) throw rpcError;
        if (!rpcResult) return;

        const rpcData = rpcResult as {
          sessions: any[];
          sessionStudents: Record<string, any[]>;
          sessionStaff: Record<string, any[]>;
          classesById: Record<string, any>;
          subjectsById: Record<string, any>;
          total: number;
        };

        // Filter out sessions that already have tutor logs
        const { data: existingLogs } = await supabase
          .from('tutor_logs')
          .select('session_id');
        
        const loggedSessionIds = new Set((existingLogs || []).map((log: any) => log.session_id));
        const unloggedSessions = (rpcData.sessions || []).filter(
          (s: any) => !loggedSessionIds.has(s.id)
        );

        setSessions(unloggedSessions);
        setSessionStudents(rpcData.sessionStudents || {});
        setSessionStaff(rpcData.sessionStaff || {});
        setClassesById(rpcData.classesById || {});
        setSubjectsById(rpcData.subjectsById || {});
      } catch (error) {
        console.error('Error fetching sessions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [staffId]);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No sessions available to log.</p>
        <p className="text-sm text-muted-foreground mt-2">
          All past sessions have been logged or you have no sessions assigned.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {sessions.map((session) => {
          const isSelected = session.id === selectedSessionId;
          const classData = classesById[session.class_id];
          const subject = classData?.subject_id ? subjectsById[classData.subject_id] : undefined;
          const staff = (sessionStaff[session.id] || []).map((sf: any) => ({
            ...sf.staff || sf,
            planned_absence: sf.planned_absence,
          }));
          const students = (sessionStudents[session.id] || []).map((ss: any) => ({
            ...ss.student || ss,
            planned_absence: ss.planned_absence,
            is_extra: ss.is_extra,
          }));

          return (
            <div
              key={session.id}
              className={cn(
                'cursor-pointer transition-all',
                isSelected && 'ring-2 ring-primary rounded-lg'
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <SessionsCard
                session={session}
                classData={classData}
                subject={subject}
                staff={staff}
                students={students}
                isSelecting={true}
                isSelected={isSelected}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}


