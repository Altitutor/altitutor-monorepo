'use client';

import { StudentViewContent } from '@/features/students/components/StudentViewContent';
import { StaffViewContent } from '@/features/staff/components/modal/StaffViewContent';
import { ClassViewContent } from '@/features/classes/components/modal/ClassViewContent';
import { useSessionData } from '@/features/sessions/hooks';
import { SessionDetailsTab } from '@/features/sessions/components/SessionDetailsTab';
import { InvoiceCard } from '@/shared/components/InvoiceCard';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { Separator } from '@altitutor/ui';
import { SessionFiles } from '@/features/sessions/components/SessionFiles';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { 
  buildStudentAttendanceMap, 
  buildStaffAttendanceMap, 
  processSessionStudents, 
  processSessionStaff 
} from '@/features/sessions/utils';
import { useSessionModals, useSessionHelpers } from '@/features/sessions/hooks';

interface EntityTabContentProps {
  type: 'message' | 'student' | 'staff' | 'class' | 'session' | 'invoice';
  id: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EntityTabContent({ type, id, isOpen, onClose }: EntityTabContentProps) {
  if (type === 'student') {
    return <StudentViewContent studentId={id} isOpen={isOpen} onClose={onClose} onStudentUpdated={() => {}} hideHeader={true} />;
  }

  if (type === 'staff') {
    return <StaffViewContent staffId={id} isOpen={isOpen} onClose={onClose} onStaffUpdated={() => {}} hideHeader={true} />;
  }

  if (type === 'class') {
    return <ClassViewContent classId={id} isOpen={isOpen} onClose={onClose} onClassUpdated={() => {}} hideHeader={true} />;
  }

  if (type === 'message') {
    return (
      <div className="h-full">
        <MessagesTabContent 
          conversationId={id}
          title="Conversation"
          onClose={onClose}
        />
      </div>
    );
  }

  if (type === 'session') {
    return <SessionTabContent id={id} isOpen={isOpen} onClose={onClose} />;
  }

  if (type === 'invoice') {
    return <InvoiceTabContent id={id} isOpen={isOpen} />;
  }

  return (
    <div className="p-6 flex items-center justify-center text-muted-foreground h-full">
      Loading {type} content...
    </div>
  );
}

function SessionTabContent({ id, isOpen, onClose }: { id: string, isOpen: boolean, onClose: () => void }) {
  const { data: currentStaff } = useCurrentStaff();
  const sessionData = useSessionData({
    sessionId: id,
    enabled: isOpen,
  });
  
  const sessionHelpers = useSessionHelpers({
    session: sessionData.data?.session,
    sessionsStudents: sessionData.data?.sessionsStudents || [],
    sessionsStaff: sessionData.data?.sessionsStaff || [],
    tutorLog: sessionData.data?.tutorLog,
    firstClassStaffId: sessionData.firstClassStaffId,
  });

  if (sessionData.isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading session...</div>;
  }

  if (!sessionData.data) {
    return <div className="p-6 text-center text-muted-foreground">Session not found</div>;
  }

  const { session, sessionsStudents, sessionsStaff, tutorLog } = sessionData.data;
  const actualStudentAttendance = buildStudentAttendanceMap(tutorLog);
  const actualStaffAttendance = buildStaffAttendanceMap(tutorLog);
  const studentsData = processSessionStudents(sessionsStudents, actualStudentAttendance, sessionHelpers.hasTutorLog);
  const staffData = processSessionStaff(sessionsStaff, actualStaffAttendance, sessionHelpers.hasTutorLog, tutorLog?.created_by);

  return (
    <div className="p-6 h-full overflow-y-auto">
      <SessionDetailsTab
        session={session}
        studentsData={studentsData}
        staffData={staffData}
        tutorLog={tutorLog}
        allTopics={sessionData.allTopics}
        sessionId={id}
        isSessionInPast={sessionHelpers.isSessionInPast}
        currentStaff={currentStaff || null}
        onOpenSession={() => {}}
        onOpenStudent={() => {}}
        onOpenStaff={() => {}}
        onOpenClass={() => {}}
        onMessageStudent={() => {}}
        onMessageStaff={() => {}}
        onOpenTopic={() => {}}
        onOpenFile={() => {}}
        onLogAbsenceStudent={() => {}}
        onLogAbsenceStaff={() => {}}
        onSendBookingConfirmation={() => {}}
      />
      {session.type !== 'CLASS' && (
        <>
          <Separator className="my-6" />
          <SessionFiles sessionId={id} />
        </>
      )}
    </div>
  );
}

function InvoiceTabContent({ id, isOpen }: { id: string, isOpen: boolean }) {
  const { data: invoice } = useQuery({
    queryKey: ['invoices', id],
    queryFn: async () => {
      const { data } = await getSupabaseClient().from('invoices').select('*').eq('id', id).single();
      return data;
    },
    enabled: isOpen
  });

  if (!invoice) {
    return <div className="p-6 text-center text-muted-foreground">Loading invoice...</div>;
  }

  return (
    <div className="p-6">
      <InvoiceCard invoice={invoice as any} />
    </div>
  );
}
