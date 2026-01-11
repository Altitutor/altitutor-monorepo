'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@altitutor/ui';
import { Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sessionsApi } from '@/features/sessions/api/sessions';
import { getSessionTitle } from '@/features/sessions/utils/session-helpers';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@altitutor/ui';
import { SessionActivityTab } from '@/features/activity/components/tabs/SessionActivityTab';
import { SessionDetailsTab } from '@/features/sessions/components/SessionDetailsTab';

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allTopics, setAllTopics] = useState<Tables<'topics'>[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const openWindow = useChatStore(s => s.openWindow);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const result = await sessionsApi.getSessionWithTutorLog(id);
        setData(result);
        
        if (result.session?.class?.subject?.id) {
          const supabaseClient = (await import('@/shared/lib/supabase/client')).getSupabaseClient() as SupabaseClient<Database>;
          const { data: topicsData } = await supabaseClient
            .from('topics')
            .select('*')
            .eq('subject_id', result.session.class.subject.id)
            .order('index', { ascending: true });
          
          setAllTopics(topicsData || []);
        }
      } catch (error) {
        console.error('Failed to load session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      load();
    }
  }, [id]);

  const handleOpenSession = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  const handleOpenStaff = (staffId: string) => {
    setSelectedStaffId(staffId);
    setIsStaffModalOpen(true);
  };

  const handleOpenTopic = (topicId: string) => {
    // Get subject ID from session's subject if available, otherwise from class's subject
    const subjectId = (data?.session as any)?.subject?.id || data?.session?.class?.subject?.id;
    if (subjectId) {
      router.push(`/subjects/${subjectId}/topics/${topicId}`);
    } else {
      // Fallback to old route if subject not available
      router.push(`/topics/${topicId}`);
    }
  };

  const handleOpenFile = (fileId: string) => {
    window.dispatchEvent(new CustomEvent('open-file-preview', { detail: { id: fileId } }));
  };

  const handleMessageStudent = async (studentId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(studentId, 'student');
      if (conversationId) {
        openWindow({ conversationId, title: 'Student' });
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
    }
  };

  const handleMessageStaff = async (staffId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(staffId, 'staff');
      if (conversationId) {
        openWindow({ conversationId, title: 'Staff' });
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || !data.session) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/sessions')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Session Not Found</h1>
        </div>
      </div>
    );
  }

  const { session, sessionsStudents, sessionsStaff, tutorLog } = data;
  const sessionTitle = getSessionTitle(session);
  const hasTutorLog = !!tutorLog;
  // Use session's subject if available, otherwise fall back to class's subject
  const subject = (session as any).subject || session.class?.subject;
  
  // Check if session is in the past
  const isSessionInPast = session.start_at ? new Date(session.start_at) < new Date() : false;

  // Build student attendance map from tutor log
  const actualStudentAttendance: Record<string, { attended: boolean }> = {};
  if (tutorLog?.studentAttendance) {
    tutorLog.studentAttendance.forEach((att: any) => {
      actualStudentAttendance[att.student_id] = { attended: att.attended };
    });
  }

  // Build staff attendance map from tutor log
  const actualStaffAttendance: Record<string, { attended: boolean; type?: string }> = {};
  if (tutorLog?.staffAttendance) {
    tutorLog.staffAttendance.forEach((att: any) => {
      actualStaffAttendance[att.staff_id] = { attended: att.attended, type: att.type };
    });
  }

  // Process students
  // Build set of student IDs that are in sessions_students (planned students)
  // Include all planned students regardless of is_extra status
  const plannedStudentIds = new Set(
    sessionsStudents
      .filter((ss: any) => ss.student_id && (ss.sessions_students_id !== null && ss.sessions_students_id !== undefined))
      .map((ss: any) => ss.student_id)
  );
  
  const studentsData = sessionsStudents.map((ss: any) => {
    let plannedStatus: 'attending' | 'attending-extra' | 'absent' | 'rescheduled' | 'credited' | 'unplanned' = 'attending';
    let rescheduledDate = '';
    
    const isUnplanned = (ss.sessions_students_id === null || ss.sessions_students_id === undefined) && ss.is_extra;
    
    if (ss.planned_absence && !isUnplanned) {
      plannedStatus = 'absent';
      if (ss.is_rescheduled && ss.rescheduled_session?.session) {
        plannedStatus = 'rescheduled';
        const resSession = ss.rescheduled_session.session;
        rescheduledDate = resSession.start_at 
          ? `${format(new Date(resSession.start_at), 'EEE dd/MM')} ${resSession.class?.start_time || ''}`
          : '';
      } else if (ss.is_credited) {
        plannedStatus = 'credited';
      }
    } else if (isUnplanned) {
      plannedStatus = 'unplanned';
    } else if (ss.is_extra && plannedStudentIds.has(ss.student_id)) {
      plannedStatus = 'attending-extra';
    }
    
    const actualAttendance = actualStudentAttendance[ss.student_id];
    const actualStatus = !hasTutorLog
      ? 'not-logged'
      : actualAttendance?.attended
      ? 'attended'
      : 'did-not-attend';
    
    return {
      student: ss.student,
      plannedStatus,
      actualStatus,
      rescheduledDate,
      rescheduledSessionId: ss.rescheduled_session?.session?.id,
      invoiceStatus: ss.invoice_status || null,
      plannedAbsence: ss.planned_absence || false,
      hasInvoiceItems: !!ss.invoice_status,
    };
  });

  // Process staff
  const staffData = sessionsStaff.map((sf: any) => {
    let plannedStatus: 'attending' | 'absent' | 'swapped' = 'attending';
    let swappedStaffName = '';
    let swappedStaffId = '';
    
    if (sf.planned_absence) {
      plannedStatus = 'absent';
      if (sf.is_swapped && sf.swapped_staff) {
        plannedStatus = 'swapped';
        swappedStaffName = `${sf.swapped_staff.first_name} ${sf.swapped_staff.last_name}`;
        swappedStaffId = sf.swapped_staff.id;
      }
    }
    
    const actualAttendance = actualStaffAttendance[sf.staff_id];
    const actualStatus = !hasTutorLog
      ? 'not-logged'
      : actualAttendance?.attended
      ? 'attended'
      : 'did-not-attend';
    
    const submittedTutorLog = tutorLog?.created_by === sf.staff_id;
    
    return {
      staff: sf.staff,
      plannedStatus,
      actualStatus,
      staffType: actualAttendance?.type,
      swappedStaffName,
      swappedStaffId,
      submittedTutorLog,
      plannedAbsence: sf.planned_absence || false,
    };
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/sessions')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Session Details</h1>
          <p className="text-lg text-muted-foreground mt-1">
            {sessionTitle}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full">
          <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <SessionDetailsTab
            session={session}
            studentsData={studentsData}
            staffData={staffData}
            tutorLog={tutorLog}
            allTopics={allTopics}
            sessionId={id}
            isSessionInPast={isSessionInPast}
            currentStaff={null}
            onOpenSession={handleOpenSession}
            onOpenStudent={(studentId) => {
              setSelectedStudentId(studentId);
              setIsStudentModalOpen(true);
            }}
            onOpenStaff={handleOpenStaff}
            onMessageStudent={handleMessageStudent}
            onMessageStaff={handleMessageStaff}
            onOpenTopic={handleOpenTopic}
            onOpenFile={handleOpenFile}
          />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <SessionActivityTab sessionId={id} isOpen={true} />
        </TabsContent>
      </Tabs>

      {/* Student Modal */}
      {selectedStudentId && (
        <ViewStudentModal
          isOpen={isStudentModalOpen}
          onClose={() => {
            setIsStudentModalOpen(false);
            setSelectedStudentId(null);
          }}
          studentId={selectedStudentId}
          onStudentUpdated={() => {}}
        />
      )}

      {/* Staff Modal */}
      {selectedStaffId && (
        <ViewStaffModal
          isOpen={isStaffModalOpen}
          onClose={() => {
            setIsStaffModalOpen(false);
            setSelectedStaffId(null);
          }}
          staffId={selectedStaffId}
          onStaffUpdated={() => {}}
        />
      )}
    </div>
  );
}
