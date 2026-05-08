'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, Button, Separator, Tabs, TabsContent, TabsList, TabsTrigger, useToast, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@altitutor/ui';
import { useRouter } from 'next/navigation';
import { useSessionActions } from '../hooks/useSessionActions';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { X } from 'lucide-react';
import { getSessionTitle, getShortSessionName } from '../utils/session-helpers';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewClassModal } from '@/features/classes';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { SessionFiles } from './SessionFiles';
import { SessionActivityTab } from '@/features/activity/components/tabs/SessionActivityTab';
import { LogSessionModal, EditTutorLogDialog } from '@/features/tutor-logs';
import { useCurrentStaff } from '@/shared/hooks';
import { SendBookingConfirmationDialog } from './SendBookingConfirmationDialog';
import { LogAbsenceDialog, LogStaffAbsenceDialog } from './absences';
import { SessionDetailsTab, type SessionEditFormData } from './SessionDetailsTab';
import { AddStudentToSessionModal } from './AddStudentToSessionModal';
import { AddStaffToSessionModal } from './AddStaffToSessionModal';
import { RemoveFromSessionConfirmDialog } from './RemoveFromSessionConfirmDialog';
import { UndoLogAbsenceConfirmDialog } from './UndoLogAbsenceConfirmDialog';
import {
  useSessionData,
  useSessionModals,
  useSessionHelpers,
  useAddStudentToSession,
  useAssignStaffToSession,
  useRemoveStudentFromSession,
  useRemoveStaffFromSession,
  useUndoAbsences,
  useUndoStaffAbsences,
  useAddParentToSession,
  useRemoveParentFromSession,
  useUpdateSession,
} from '../hooks';
import {
  buildStudentAttendanceMap,
  buildStaffAttendanceMap,
  processSessionStudents,
  processSessionStaff,
} from '../utils';
import { IssuePill } from '@/features/issues';
import { formatTime } from '@/shared/utils/datetime';
import type { Tables, TablesUpdate } from '@altitutor/shared';
import { Loader2 } from 'lucide-react';

type SessionModalProps = {
  isOpen: boolean;
  sessionId: string | null;
  onClose: () => void;
};

type UndoTarget =
  | {
      entityType: 'student';
      studentId: string;
      studentName: string;
      sessionsStudentsId: string;
      action: 'credit' | 'reschedule';
      rescheduledSessionTitle?: string;
    }
  | {
      entityType: 'staff';
      staffId: string;
      staffName: string;
      sessionsStaffId: string;
      action: 'log' | 'swap';
      swappedStaffName?: string;
    };

export function SessionModal({ isOpen, sessionId, onClose }: SessionModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const openWindow = useChatStore(s => s.openWindow);
  const { data: currentStaff } = useCurrentStaff();
  const addStudentMutation = useAddStudentToSession();
  const addStaffMutation = useAssignStaffToSession();
  const removeStudentMutation = useRemoveStudentFromSession();
  const removeStaffMutation = useRemoveStaffFromSession();
  const addParentMutation = useAddParentToSession();
  const removeParentMutation = useRemoveParentFromSession();
  const undoAbsenceMutation = useUndoAbsences();
  const undoStaffAbsenceMutation = useUndoStaffAbsences();
  const updateSessionMutation = useUpdateSession();

  // Business logic hooks
  const sessionData = useSessionData({
    sessionId: sessionId,
    enabled: isOpen && !!sessionId,
  });

  const modals = useSessionModals();

  // UI state
  const [activeTab, setActiveTab] = useState('details');
  const [undoTarget, setUndoTarget] = useState<UndoTarget | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<SessionEditFormData | null>(null);

  // Reset modals when modal closes
  useEffect(() => {
    if (!isOpen) {
      modals.reset();
      setUndoTarget(null);
      setIsEditing(false);
      setPendingSaveData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSessionUpdate = async (data: SessionEditFormData) => {
    if (!sessionId) return;
    try {
      const startAtLocal = `${data.date}T${data.startTime}`;
      const endAtLocal = `${data.date}T${data.endTime}`;
      const update: TablesUpdate<'sessions'> = {
        type: data.type as TablesUpdate<'sessions'>['type'],
        start_at: new Date(startAtLocal).toISOString(),
        end_at: new Date(endAtLocal).toISOString(),
        subject_id: data.type === 'CLASS' ? (data.subjectId ?? null) : null,
        class_id: data.type === 'CLASS' ? (data.classId ?? null) : null,
      };
      await updateSessionMutation.mutateAsync({ id: sessionId, data: update });
      await sessionData.refresh();
      setIsEditing(false);
      setPendingSaveData(null);
      toast({
        title: 'Session updated',
        description: 'Session has been updated successfully.',
      });
    } catch (err) {
      console.error('Failed to update session:', err);
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Failed to update session. Please try again.',
        variant: 'destructive',
      });
      throw err;
    }
  };

  const handleSessionFormSubmit = async (data: SessionEditFormData) => {
    setPendingSaveData(data);
  };

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

  const handleMutationError = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    const lower = message.toLowerCase();
    if (lower.includes('duplicate') || lower.includes('already')) {
      toast({
        title: 'Already in session',
        description: 'This person is already in the session.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Error',
      description: message,
      variant: 'destructive',
    });
  };

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
    sessionId: sessionId || '',
    onOpenInPage: () => {
      router.push(`/sessions/${sessionId}`);
      onClose();
    },
    onLogSession: modals.openLogSessionModal,
    onEditTutorLog: modals.openEditTutorLogModal,
    hasTutorLog: helpers.hasTutorLog,
  });

  // Always render the Sheet to allow exit animation
  if (sessionData.isLoading || !sessionData.data) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full md:w-[600px] md:max-w-none overflow-y-auto p-0">
          <SheetHeader className="px-6 py-4">
            <SheetTitle>{sessionData.isLoading ? 'Loading...' : ''}</SheetTitle>
            <SheetDescription className="sr-only">
              {sessionData.isLoading ? 'Loading session details.' : 'Session details unavailable.'}
            </SheetDescription>
          </SheetHeader>
          {sessionData.isLoading && (
            <div className="py-6 text-center text-muted-foreground px-6">Loading session details...</div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  const { session, sessionsStudents, sessionsStaff, tutorLog, sessionsParents = [] } = sessionData.data;
  const meetingMode = session.type !== 'CLASS';
  const allowAbsenceLogging = Boolean(session.class_id || session.admin_shift_id);
  const parentsData = (sessionsParents as Array<{ id: string; parent: Tables<'parents'> | null }>)
    .filter((row): row is { id: string; parent: Tables<'parents'> } => row.parent != null)
    .map((row) => ({ parent: row.parent, sessionsParentsId: row.id }));
  const sessionTitle = getSessionTitle(session);
  const sessionShortName = getShortSessionName(session);
  const sessionDay = session.start_at
    ? new Date(session.start_at).toLocaleDateString('en-US', { weekday: 'long' })
    : 'Unknown day';
  const sessionTime = (() => {
    if (session.start_at && session.end_at) {
      const start = new Date(session.start_at);
      const end = new Date(session.end_at);
      const startHHMM = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
      const endHHMM = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      return `${formatTime(startHHMM)} - ${formatTime(endHHMM)}`;
    }
    if (session.class?.start_time && session.class?.end_time) {
      return `${formatTime(session.class.start_time)} - ${formatTime(session.class.end_time)}`;
    }
    return 'Unknown time';
  })();

  // Process attendance data
  const actualStudentAttendance = buildStudentAttendanceMap(tutorLog);
  const actualStaffAttendance = buildStaffAttendanceMap(tutorLog);

  // Process students and staff data
  const studentsData = processSessionStudents(sessionsStudents, actualStudentAttendance, helpers.hasTutorLog);
  const staffData = processSessionStaff(sessionsStaff, actualStaffAttendance, helpers.hasTutorLog, tutorLog?.created_by);
  type SessionsStudentRow = { student_id: string | null };
  type SessionsStaffRow = { staff_id: string | null };
  const existingStudentIds = (sessionsStudents as SessionsStudentRow[])
    .map((row) => row.student_id)
    .filter((id: string | null | undefined): id is string => !!id);
  const existingStaffIds = (sessionsStaff as SessionsStaffRow[])
    .map((row) => row.staff_id)
    .filter((id: string | null | undefined): id is string => !!id);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent hideCloseButton className="h-full max-h-[100dvh] flex flex-col p-0 w-full md:w-[600px] md:max-w-none">
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
                      <SheetDescription asChild>
                        <div className="text-lg font-medium text-muted-foreground flex items-center gap-2 flex-wrap">
                          {sessionTitle}
                          <IssuePill
                            entityType="session"
                            entityId={sessionId}
                            enabled={isOpen && !!sessionId}
                          />
                        </div>
                      </SheetDescription>
                    </div>
                  </div>
                  {sessionId && (
                    <ActionsMenu
                      type="session"
                      entityId={sessionId}
                      copyTagDisplayText={sessionTitle || sessionId}
                      {...sessionActions}
                      sessionType={session.type}
                      sessionStudents={studentsData.map((d: { student: { id: string; first_name: string; last_name: string } }) => ({
                        id: d.student.id,
                        name: `${d.student.first_name} ${d.student.last_name}`,
                      }))}
                      onSendBookingConfirmation={modals.openBookingConfirmationDialog}
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
                    key={`session-details-${sessionId ?? ''}-${isEditing}`}
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
                    onLogAbsenceStudent={allowAbsenceLogging ? modals.openLogStudentAbsenceDialog : undefined}
                    onLogAbsenceStaff={allowAbsenceLogging ? modals.openLogStaffAbsenceDialog : undefined}
                    isEditing={isEditing}
                    onEdit={() => setIsEditing(true)}
                    onCancelEdit={() => setIsEditing(false)}
                    onSubmit={handleSessionFormSubmit}
                    isUpdating={updateSessionMutation.isPending}
                    onUndoLogAbsenceStudent={
                      allowAbsenceLogging
                        ? (payload) => {
                      type SessionsStudentRowWithId = { sessions_students_id?: string; id?: string; rescheduled_session?: { session?: unknown } };
                      const sourceRow = (sessionsStudents as SessionsStudentRowWithId[]).find((row) =>
                        (row.sessions_students_id || row.id) === payload.sessionsStudentsId
                      );
                      const rescheduledSession = sourceRow?.rescheduled_session?.session;

                      setUndoTarget({
                        entityType: 'student',
                        studentId: payload.studentId,
                        studentName: payload.studentName,
                        sessionsStudentsId: payload.sessionsStudentsId,
                        action: payload.action,
                        rescheduledSessionTitle: rescheduledSession
                          ? getShortSessionName(rescheduledSession)
                          : undefined,
                      });
                    }
                        : undefined
                    }
                    onUndoLogAbsenceStaff={
                      allowAbsenceLogging
                        ? (payload) => {
                      setUndoTarget({
                        entityType: 'staff',
                        staffId: payload.staffId,
                        staffName: payload.staffName,
                        sessionsStaffId: payload.sessionsStaffId,
                        action: payload.action,
                        swappedStaffName: payload.swappedStaffName,
                      });
                    }
                        : undefined
                    }
                    onAddStudentToSession={meetingMode ? undefined : modals.openAddStudentToSessionModal}
                    onAddStaffToSession={meetingMode ? undefined : modals.openAddStaffToSessionModal}
                    meetingMode={meetingMode}
                    parentsData={parentsData}
                    onMeetingAddStudent={async (student) => {
                      if (!sessionId) return;
                      await addStudentMutation.mutateAsync({ sessionId, studentId: student.id });
                      await sessionData.refresh();
                      toast({ title: 'Student added', description: `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() });
                    }}
                    onMeetingAddStaff={async (staffMember) => {
                      if (!sessionId) return;
                      await addStaffMutation.mutateAsync({ sessionId, staffId: staffMember.id, type: 'MAIN_TUTOR' });
                      await sessionData.refresh();
                      toast({ title: 'Staff added', description: `${staffMember.first_name ?? ''} ${staffMember.last_name ?? ''}`.trim() });
                    }}
                    onMeetingAddParent={async (parent) => {
                      if (!sessionId) return;
                      await addParentMutation.mutateAsync({ sessionId, parentId: parent.id });
                      await sessionData.refresh();
                      toast({ title: 'Parent added', description: `${parent.first_name ?? ''} ${parent.last_name ?? ''}`.trim() });
                    }}
                    onRemoveParentFromSession={(parentId, parentName) =>
                      modals.openRemoveFromSessionDialog({ entityType: 'parent', entityId: parentId, entityName: parentName })
                    }
                    onRemoveStudentFromSession={(studentId, studentName) =>
                      modals.openRemoveFromSessionDialog({ entityType: 'student', entityId: studentId, entityName: studentName })
                    }
                    onRemoveStaffFromSession={(staffId, staffName) =>
                      modals.openRemoveFromSessionDialog({ entityType: 'staff', entityId: staffId, entityName: staffName })
                    }
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
            {sessionId && isEditing && activeTab === 'details' && (
              <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
                <div className="flex w-full justify-end">
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={updateSessionMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={updateSessionMutation.isPending}
                      onClick={() => {
                        const form = document.getElementById('session-edit-form') as HTMLFormElement | null;
                        if (form) form.requestSubmit();
                      }}
                    >
                      {updateSessionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Tabs>
        </SheetContent>
      </Sheet>
      
      {/* Save confirmation dialog */}
      <AlertDialog open={!!pendingSaveData} onOpenChange={(open) => !open && setPendingSaveData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save session changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save these changes to the session? This will update the session type, date, time, subject, and/or class.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (pendingSaveData) {
                  await handleSessionUpdate(pendingSaveData);
                }
              }}
              disabled={updateSessionMutation.isPending}
            >
              {updateSessionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          initialSessionKind={session.type !== 'CLASS' ? 'meeting' : 'class'}
        />
      )}

      {/* Edit Tutor Log Modal */}
      {tutorLog?.id && modals.isEditTutorLogModalOpen && (
        <EditTutorLogDialog
          tutorLogId={tutorLog.id}
          isOpen={modals.isEditTutorLogModalOpen}
          onClose={async () => {
            modals.closeEditTutorLogModal();
            if (sessionId && isOpen) {
              await sessionData.refresh();
            }
          }}
          onTutorLogUpdated={async () => {
            if (sessionId && isOpen) {
              await sessionData.refresh();
            }
          }}
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

      {!meetingMode && (
        <>
          <AddStudentToSessionModal
            isOpen={modals.isAddStudentToSessionModalOpen}
            onClose={modals.closeAddStudentToSessionModal}
            sessionTitle={sessionTitle}
            sessionTime={sessionTime}
            sessionDay={sessionDay}
            existingStudentIds={existingStudentIds}
            isPending={addStudentMutation.isPending}
            onConfirm={async (student) => {
              if (!sessionId) return;
              try {
                await addStudentMutation.mutateAsync({ sessionId, studentId: student.id });
                await sessionData.refresh();
                toast({
                  title: 'Student added',
                  description: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student added to session.',
                });
              } catch (error) {
                handleMutationError(error);
                throw error;
              }
            }}
          />

          <AddStaffToSessionModal
            isOpen={modals.isAddStaffToSessionModalOpen}
            onClose={modals.closeAddStaffToSessionModal}
            sessionTitle={sessionTitle}
            sessionTime={sessionTime}
            sessionDay={sessionDay}
            existingStaffIds={existingStaffIds}
            isPending={addStaffMutation.isPending}
            onConfirm={async (staff) => {
              if (!sessionId) return;
              try {
                await addStaffMutation.mutateAsync({ sessionId, staffId: staff.id, type: 'MAIN_TUTOR' });
                await sessionData.refresh();
                toast({
                  title: 'Staff added',
                  description: `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Staff added to session.',
                });
              } catch (error) {
                handleMutationError(error);
                throw error;
              }
            }}
          />
        </>
      )}

      {modals.removeFromSessionTarget && (
        <RemoveFromSessionConfirmDialog
          isOpen={modals.isRemoveFromSessionDialogOpen}
          entityType={modals.removeFromSessionTarget.entityType}
          entityName={modals.removeFromSessionTarget.entityName}
          sessionTitle={sessionTitle}
          isPending={removeStudentMutation.isPending || removeStaffMutation.isPending || removeParentMutation.isPending}
          onCancel={modals.closeRemoveFromSessionDialog}
          onConfirm={async () => {
            if (!sessionId || !modals.removeFromSessionTarget) return;
            const target = modals.removeFromSessionTarget;
            try {
              if (target.entityType === 'student') {
                await removeStudentMutation.mutateAsync({ sessionId, studentId: target.entityId });
              } else if (target.entityType === 'staff') {
                await removeStaffMutation.mutateAsync({ sessionId, staffId: target.entityId });
              } else {
                await removeParentMutation.mutateAsync({ sessionId, parentId: target.entityId });
              }
              await sessionData.refresh();
              modals.closeRemoveFromSessionDialog();
              toast({
                title: `${target.entityType === 'student' ? 'Student' : target.entityType === 'staff' ? 'Staff' : 'Parent'} removed`,
                description: `${target.entityName} removed from session.`,
              });
            } catch (error) {
              handleMutationError(error);
            }
          }}
        />
      )}

      {undoTarget && currentStaff && (
        <UndoLogAbsenceConfirmDialog
          isOpen={!!undoTarget}
          title="Undo logged absence?"
          description={
            undoTarget.entityType === 'student'
              ? `Mark ${undoTarget.studentName} as attending ${sessionShortName}?`
              : `Mark ${undoTarget.staffName} as attending ${sessionShortName}?`
          }
          secondaryDescription={
            undoTarget.entityType === 'student' && undoTarget.action === 'reschedule' && undoTarget.rescheduledSessionTitle
              ? `This will remove them from the rescheduled session ${undoTarget.rescheduledSessionTitle}.`
              : undoTarget.entityType === 'staff' && undoTarget.action === 'swap' && undoTarget.swappedStaffName
              ? `This will remove replacement staff ${undoTarget.swappedStaffName} from this session.`
              : undefined
          }
          confirmLabel="Undo Log Absence"
          isPending={undoAbsenceMutation.isPending || undoStaffAbsenceMutation.isPending}
          onCancel={() => setUndoTarget(null)}
          onConfirm={async () => {
            try {
              if (undoTarget.entityType === 'student') {
                const result = await undoAbsenceMutation.mutateAsync({
                  staffId: currentStaff.id,
                  operations: [
                    {
                      student_id: undoTarget.studentId,
                      original_sessions_students_id: undoTarget.sessionsStudentsId,
                      action: undoTarget.action,
                    },
                  ],
                });

                if (!result.success) {
                  toast({
                    title: 'Error',
                    description: result.error || 'Failed to undo absence',
                    variant: 'destructive',
                  });
                  return;
                }
              } else {
                const result = await undoStaffAbsenceMutation.mutateAsync({
                  staffId: currentStaff.id,
                  operations: [
                    {
                      staff_id: undoTarget.staffId,
                      original_sessions_staff_id: undoTarget.sessionsStaffId,
                      action: undoTarget.action,
                    },
                  ],
                });

                if (!result.success) {
                  toast({
                    title: 'Error',
                    description: result.error || 'Failed to undo staff absence',
                    variant: 'destructive',
                  });
                  return;
                }
              }

              await sessionData.refresh();
              setUndoTarget(null);
              toast({
                title: 'Absence undone',
                description: 'Attendance has been restored for this session.',
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to undo absence';
              toast({
                title: 'Error',
                description: message,
                variant: 'destructive',
              });
            }
          }}
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

    </>
  );
}
