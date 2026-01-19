'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, Button, Separator, Tabs, TabsContent, TabsList, TabsTrigger } from '@altitutor/ui';
import { useRouter } from 'next/navigation';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { X } from 'lucide-react';
import { getSessionTitle } from '../utils/session-helpers';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewClassModal } from '@/features/classes';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { SessionFiles } from './SessionFiles';
import { SessionActivityTab } from '@/features/activity/components/tabs/SessionActivityTab';
import { LogSessionModal } from '@/features/tutor-logs';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { SendBookingConfirmationDialog } from './SendBookingConfirmationDialog';
import { LogAbsenceDialog, LogStaffAbsenceDialog } from './absences';
import { SessionDetailsTab } from './SessionDetailsTab';
import { BookSessionModal } from '@/features/bookings/components/BookSessionModal';
import {
  useSessionData,
  useSessionModals,
  useSessionHelpers,
} from '../hooks';
import {
  buildStudentAttendanceMap,
  buildStaffAttendanceMap,
  processSessionStudents,
  processSessionStaff,
} from '../utils';

type SessionModalProps = {
  isOpen: boolean;
  sessionId: string | null;
  onClose: () => void;
};

export function SessionModal({ isOpen, sessionId, onClose }: SessionModalProps) {
  const router = useRouter();
  const openWindow = useChatStore(s => s.openWindow);
  const { data: currentStaff } = useCurrentStaff();

  // Business logic hooks
  const sessionData = useSessionData({
    sessionId: sessionId,
    enabled: isOpen && !!sessionId,
  });

  const modals = useSessionModals();

  // UI state
  const [activeTab, setActiveTab] = useState('details');

  // Reset modals when modal closes
  useEffect(() => {
    if (!isOpen) {
      modals.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleOpenSession = (id: string) => {
    // Close current modal and open new one
    onClose();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-session-modal', { detail: { id } }));
    }, 100);
  };

  const handleOpenStaff = (id: string) => {
    modals.openStaffModal(id);
  };

  const handleOpenClass = (id: string) => {
    modals.openClassModal(id);
  };

  const handleOpenTopic = (id: string) => {
    window.dispatchEvent(new CustomEvent('open-topic-modal', { detail: { id } }));
  };

  const handleOpenFile = (id: string) => {
    window.dispatchEvent(new CustomEvent('open-file-preview', { detail: { id } }));
  };

  const handleMessageStudent = async (studentId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(studentId, 'student');
      if (conversationId) {
        onClose();
        setTimeout(() => {
          openWindow({ conversationId, title: 'Student' });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
    }
  };

  const handleMessageStaff = async (staffId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(staffId, 'staff');
      if (conversationId) {
        onClose();
        setTimeout(() => {
          openWindow({ conversationId, title: 'Staff' });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
    }
  };

  // Session helpers
  const helpers = useSessionHelpers({
    session: sessionData.data?.session,
    sessionsStudents: sessionData.data?.sessionsStudents || [],
    sessionsStaff: sessionData.data?.sessionsStaff || [],
    tutorLog: sessionData.data?.tutorLog,
    firstClassStaffId: sessionData.firstClassStaffId,
  });

  // Always render the Sheet to allow exit animation
  if (sessionData.isLoading || !sessionData.data) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full md:w-[600px] md:max-w-none overflow-y-auto p-0">
          <SheetHeader className="px-6 py-4">
            <SheetTitle>{sessionData.isLoading ? 'Loading...' : ''}</SheetTitle>
          </SheetHeader>
          {sessionData.isLoading && (
            <div className="py-6 text-center text-muted-foreground px-6">Loading session details...</div>
          )}
        </SheetContent>
      </Sheet>
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
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent hideCloseButton className="h-full max-h-[100vh] flex flex-col p-0 w-full md:w-[600px] md:max-w-none">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
            {/* Sticky Header */}
            <div className="flex-shrink-0 border-b bg-background sticky top-0 z-10">
              <SheetHeader className="px-6 pt-6 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={onClose}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <div className="flex-1">
                      <SheetTitle>Session Details</SheetTitle>
                      <SheetDescription className="text-lg font-medium">
                        {sessionTitle}
                      </SheetDescription>
                    </div>
                  </div>
                  {sessionId && (
                    <ActionsMenu
                      type="session"
                      onOpenInPage={() => {
                        router.push(`/sessions/${sessionId}`);
                        onClose();
                      }}
                      onLogSession={modals.openLogSessionModal}
                      hasTutorLog={helpers.hasTutorLog}
                      onReschedule={() => {
                        const studentId = helpers.getFirstStudentIdForReschedule();
                        if (studentId) {
                          modals.openRescheduleModal(studentId);
                        }
                      }}
                      canReschedule={helpers.canReschedule}
                    />
                  )}
                </div>
              </SheetHeader>
              <div className="px-6 pb-4">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                  <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 min-h-0 relative">
              <TabsContent value="details" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                <div className="p-6">
                  <SessionDetailsTab
                    session={session}
                    studentsData={studentsData}
                    staffData={staffData}
                    tutorLog={tutorLog}
                    allTopics={sessionData.allTopics}
                    sessionId={sessionId}
                    isSessionInPast={helpers.isSessionInPast}
                    currentStaff={currentStaff || null}
                    onOpenSession={handleOpenSession}
                    onOpenStudent={modals.openStudentModal}
                    onOpenStaff={handleOpenStaff}
                    onOpenClass={handleOpenClass}
                    onMessageStudent={handleMessageStudent}
                    onMessageStaff={handleMessageStaff}
                    onOpenTopic={handleOpenTopic}
                    onOpenFile={handleOpenFile}
                    onLogAbsenceStudent={modals.openLogStudentAbsenceDialog}
                    onLogAbsenceStaff={modals.openLogStaffAbsenceDialog}
                    onSendBookingConfirmation={modals.openBookingConfirmationDialog}
                  />
                  <Separator className="my-6" />
                  {/* Session Files Section - Only show for meetings, not classes */}
                  {sessionId && session.type !== 'CLASS' && (
                    <SessionFiles sessionId={sessionId} />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                <div className="p-6">
                  {sessionId && (
                    <SessionActivityTab sessionId={sessionId} isOpen={isOpen} />
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
      
      {/* Student Modal */}
      {modals.selectedStudentId && (
        <ViewStudentModal
          isOpen={modals.isStudentModalOpen}
          onClose={modals.closeStudentModal}
          studentId={modals.selectedStudentId}
          onStudentUpdated={() => {
            // Optionally refresh session data
          }}
        />
      )}

      {/* Staff Modal */}
      {modals.selectedStaffId && (
        <ViewStaffModal
          isOpen={modals.isStaffModalOpen}
          onClose={modals.closeStaffModal}
          staffId={modals.selectedStaffId}
          onStaffUpdated={() => {
            // Optionally refresh session data
          }}
        />
      )}

      {/* Class Modal */}
      {modals.selectedClassId && (
        <ViewClassModal
          isOpen={modals.isClassModalOpen}
          onClose={modals.closeClassModal}
          classId={modals.selectedClassId}
          onClassUpdated={() => {
            // Optionally refresh session data
          }}
        />
      )}

      {/* Log Session Modal */}
      {currentStaff && (
        <LogSessionModal
          isOpen={modals.isLogSessionModalOpen}
          onClose={async () => {
            modals.closeLogSessionModal();
            if (sessionId && isOpen) {
              await sessionData.refresh();
            }
          }}
          currentStaffId={currentStaff.id}
          adminMode={true}
          initialSessionId={sessionId || undefined}
          initialStaffId={helpers.getFirstStaffForLogging()}
        />
      )}

      {/* Booking Confirmation Dialog */}
      {modals.selectedStudentForBookingConfirmation && sessionId && (
        <SendBookingConfirmationDialog
          isOpen={modals.isBookingConfirmationDialogOpen}
          onClose={modals.closeBookingConfirmationDialog}
          sessionId={sessionId}
          studentId={modals.selectedStudentForBookingConfirmation}
        />
      )}

      {/* Log Student Absence Dialog */}
      {modals.selectedStudentForAbsence && sessionId && currentStaff && (
        <LogAbsenceDialog
          isOpen={modals.isLogStudentAbsenceDialogOpen}
          onClose={async () => {
            modals.closeLogStudentAbsenceDialog();
            if (sessionId && isOpen) {
              await sessionData.refresh();
            }
          }}
          staffId={currentStaff.id}
          initialStudentId={modals.selectedStudentForAbsence}
          initialSessionId={sessionId}
          allowPastSessions={true}
        />
      )}

      {/* Log Staff Absence Dialog */}
      {modals.selectedStaffForAbsence && sessionId && currentStaff && (
        <LogStaffAbsenceDialog
          isOpen={modals.isLogStaffAbsenceDialogOpen}
          onClose={async () => {
            modals.closeLogStaffAbsenceDialog();
            if (sessionId && isOpen) {
              await sessionData.refresh();
            }
          }}
          staffId={currentStaff.id}
          initialStaffId={modals.selectedStaffForAbsence}
          initialSessionId={sessionId}
          allowPastSessions={true}
        />
      )}

      {/* Reschedule Session Modal */}
      {modals.selectedStudentForReschedule && sessionId && helpers.canReschedule && (
        <BookSessionModal
          isOpen={modals.isRescheduleModalOpen}
          onClose={async () => {
            modals.closeRescheduleModal();
            if (sessionId && isOpen) {
              await sessionData.refresh();
            }
          }}
          sessionType={session.type as 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW'}
          initialStudentId={modals.selectedStudentForReschedule}
          originalSessionId={sessionId}
          originalSubjectId={helpers.subject?.id || null}
          onBookingCreated={(_newSessionId) => {
            modals.closeRescheduleModal();
          }}
        />
      )}

    </>
  );
}
