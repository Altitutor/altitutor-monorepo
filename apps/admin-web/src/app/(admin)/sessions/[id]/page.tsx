'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@altitutor/ui';
import { Loader2, ArrowLeft } from 'lucide-react';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useSessionActions } from '@/features/sessions/hooks/useSessionActions';
import { LogSessionModal } from '@/features/tutor-logs';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { getSessionTitle } from '@/features/sessions/utils/session-helpers';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@altitutor/ui';
import { SessionActivityTab } from '@/features/activity/components/tabs/SessionActivityTab';
import { SessionDetailsTab } from '@/features/sessions/components/SessionDetailsTab';
import { BookSessionModal } from '@/features/bookings/components/BookSessionModal';
import {
  useSessionData,
  useSessionModals,
  useSessionHelpers,
} from '@/features/sessions/hooks';
import {
  buildStudentAttendanceMap,
  buildStaffAttendanceMap,
  processSessionStudents,
  processSessionStaff,
} from '@/features/sessions/utils';

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const openWindow = useChatStore(s => s.openWindow);
  const { data: currentStaff } = useCurrentStaff();

  // Business logic hooks
  const sessionData = useSessionData({
    sessionId: id,
    enabled: !!id,
  });

  const modals = useSessionModals();

  // UI state
  const [activeTab, setActiveTab] = useState('details');

  // Session helpers
  const helpers = useSessionHelpers({
    session: sessionData.data?.session,
    sessionsStudents: sessionData.data?.sessionsStudents || [],
    sessionsStaff: sessionData.data?.sessionsStaff || [],
    tutorLog: sessionData.data?.tutorLog,
    firstClassStaffId: sessionData.firstClassStaffId,
  });

  // Centralized action handlers
  const sessionActions = useSessionActions({
    sessionId: id,
    onLogSession: modals.openLogSessionModal,
    hasTutorLog: helpers.hasTutorLog,
    onReschedule: () => {
      const studentId = helpers.getFirstStudentIdForReschedule();
      if (studentId) {
        modals.openRescheduleModal(studentId);
      }
    },
    canReschedule: helpers.canReschedule,
  });

  // Navigation handlers
  const handleOpenSession = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  const handleOpenStaff = (staffId: string) => {
    modals.openStaffModal(staffId);
  };

  const handleOpenTopic = (topicId: string) => {
    // Get subject ID from session's subject if available, otherwise from class's subject
    const subjectId = helpers.subject?.id;
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

  const handleOpenClass = (classId: string) => {
    router.push(`/classes/${classId}`);
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

  if (sessionData.isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!sessionData.data || !sessionData.data.session) {
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

  const { session, sessionsStudents, sessionsStaff, tutorLog } = sessionData.data;
  const sessionTitle = getSessionTitle(session);

  // Process attendance data
  const actualStudentAttendance = buildStudentAttendanceMap(tutorLog);
  const actualStaffAttendance = buildStaffAttendanceMap(tutorLog);

  // Process students and staff data
  const studentsData = processSessionStudents(sessionsStudents, actualStudentAttendance, helpers.hasTutorLog);
  const staffData = processSessionStaff(sessionsStaff, actualStaffAttendance, helpers.hasTutorLog, tutorLog?.created_by);

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
        <ActionsMenu
          type="session"
          {...sessionActions}
        />
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
            allTopics={sessionData.allTopics}
            sessionId={id}
            isSessionInPast={helpers.isSessionInPast}
            currentStaff={null}
            onOpenSession={handleOpenSession}
            onOpenStudent={modals.openStudentModal}
            onOpenStaff={handleOpenStaff}
            onOpenClass={handleOpenClass}
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
      {modals.selectedStudentId && (
        <ViewStudentModal
          isOpen={modals.isStudentModalOpen}
          onClose={modals.closeStudentModal}
          studentId={modals.selectedStudentId}
          onStudentUpdated={() => {}}
        />
      )}

      {/* Staff Modal */}
      {modals.selectedStaffId && (
        <ViewStaffModal
          isOpen={modals.isStaffModalOpen}
          onClose={modals.closeStaffModal}
          staffId={modals.selectedStaffId}
          onStaffUpdated={() => {}}
        />
      )}

      {/* Log Session Modal */}
      {currentStaff && (
        <LogSessionModal
          isOpen={modals.isLogSessionModalOpen}
          onClose={async () => {
            modals.closeLogSessionModal();
            await sessionData.refresh();
          }}
          currentStaffId={currentStaff.id}
          adminMode={true}
          initialSessionId={id}
          initialStaffId={helpers.getFirstStaffForLogging()}
        />
      )}

      {/* Reschedule Session Modal */}
      {modals.selectedStudentForReschedule && helpers.canReschedule && (
        <BookSessionModal
          isOpen={modals.isRescheduleModalOpen}
          onClose={async () => {
            modals.closeRescheduleModal();
            await sessionData.refresh();
          }}
          sessionType={session.type as 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW'}
          initialStudentId={modals.selectedStudentForReschedule}
          originalSessionId={id}
          originalSubjectId={helpers.subject?.id || null}
          onBookingCreated={(_newSessionId) => {
            modals.closeRescheduleModal();
          }}
        />
      )}
    </div>
  );
}
