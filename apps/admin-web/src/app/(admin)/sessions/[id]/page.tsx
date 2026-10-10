"use client";
import { PrimaryEntityBreadcrumb } from "@/shared/components/PrimaryEntityBreadcrumb";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  SearchableSelect,
  SearchableSelectFieldTrigger,
  Button,
  useToast,
} from "@altitutor/ui";
import type { Tables, TablesUpdate } from "@altitutor/shared";
import { defaultCheckInSessionsStaffType } from "@altitutor/shared/pay-tiers";
import { formatSessionTimeRangeForDisplay } from "@altitutor/shared";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { ActionsMenu } from "@/shared/components/ActionsMenu";
import { useSessionActions } from "@/features/sessions/hooks/useSessionActions";
import { LogSessionModal, EditTutorLogDialog } from "@/features/tutor-logs";
import { useCurrentStaff } from "@/shared/hooks";
import { formatTime } from "@/shared/utils/datetime";
import {
  formatSessionLongDate,
  formatSessionNavigationDate,
  getAdjacentSessionSiblings,
  getSessionNavigationLabel,
  getShortSessionName,
  getSessionTitle,
} from "@/features/sessions/utils/session-helpers";
import { useChatStore } from "@/features/messages/state/chatStore";
import { ensureConversationForRelated } from "@/features/messages/api/queries";
import { SegmentedTabPanel, SegmentedTabPanelContent } from "@altitutor/ui";
import { SessionActivityTab } from "@/features/activity/components/tabs/SessionActivityTab";
import { AddStudentToSessionModal } from "@/features/sessions/components/AddStudentToSessionModal";
import { AddStaffToSessionModal } from "@/features/sessions/components/AddStaffToSessionModal";
import { LogAbsenceDialog } from "@/features/sessions/components/absences/LogAbsenceDialog";
import { LogStaffAbsenceDialog } from "@/features/sessions/components/absences/LogStaffAbsenceDialog";
import {
  SessionDetailsTab,
  type SessionEditFormData,
} from "@/features/sessions/components/SessionDetailsTab";
import { SendBookingConfirmationDialog } from "@/features/sessions/components/SendBookingConfirmationDialog";
import {
  useSessionData,
  useSessionModals,
  useSessionHelpers,
  useAddStudentToSession,
  useAssignStaffToSession,
  useAddParentToSession,
  useRemoveStudentFromSession,
  useRemoveStaffFromSession,
  useRemoveParentFromSession,
  useUndoAbsences,
  useUndoStaffAbsences,
  useUpdateSession,
  useSessionsWithDetails,
} from "@/features/sessions/hooks";
import {
  buildStudentAttendanceMap,
  buildStaffAttendanceMap,
  processSessionStudents,
  processSessionStaff,
} from "@/features/sessions/utils";
import { AdminLoadingSkeleton } from "@/shared/components";
import { useEntityNavigation } from "@/shared/contexts/EntityNavigation";

import { SessionFiles } from "@/features/sessions/components/SessionFiles";
import { RemoveFromSessionConfirmDialog } from "@/features/sessions/components/RemoveFromSessionConfirmDialog";
import { UndoLogAbsenceConfirmDialog } from "@/features/sessions/components/UndoLogAbsenceConfirmDialog";
import { IssuePill } from "@/features/issues";

type UndoTarget =
  | {
      entityType: "student";
      studentId: string;
      studentName: string;
      sessionsStudentsId: string;
      action: "credit" | "reschedule";
      rescheduledSessionTitle?: string;
    }
  | {
      entityType: "staff";
      staffId: string;
      staffName: string;
      sessionsStaffId: string;
      action: "log" | "swap";
      swappedStaffName?: string;
    };

export default function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <SessionDetailView key={params.id} id={params.id} />;
}

function SessionDetailView({ id }: { id: string }) {
  const router = useRouter();
  const openWindow = useChatStore((s) => s.openWindow);
  const { data: currentStaff } = useCurrentStaff();
  const entityModals = useEntityNavigation();

  // Business logic hooks
  const sessionData = useSessionData({
    sessionId: id,
    enabled: !!id,
  });

  const classId = sessionData.data?.session?.class_id ?? null;
  const classSessionsQuery = useSessionsWithDetails(
    {
      classId: classId ?? undefined,
      includeInactive: false,
      orderBy: "start_at",
      ascending: true,
    },
    { enabled: !!classId },
  );
  const removeStudentMutation = useRemoveStudentFromSession();
  const removeStaffMutation = useRemoveStaffFromSession();
  const removeParentMutation = useRemoveParentFromSession();
  const undoAbsenceMutation = useUndoAbsences();
  const undoStaffAbsenceMutation = useUndoStaffAbsences();
  const updateSessionMutation = useUpdateSession();
  const [undoTarget, setUndoTarget] = useState<UndoTarget | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingSaveData, setPendingSaveData] =
    useState<SessionEditFormData | null>(null);
  const modals = useSessionModals();
  const { toast } = useToast();
  const addStudentMutation = useAddStudentToSession();
  const addStaffMutation = useAssignStaffToSession();
  const addParentMutation = useAddParentToSession();
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);

  const handleSessionUpdate = async (data: SessionEditFormData) => {
    if (!id) return;
    try {
      const startAtLocal = `${data.date}T${data.startTime}`;
      const endAtLocal = `${data.date}T${data.endTime}`;
      const update: TablesUpdate<"sessions"> = {
        type: data.type as TablesUpdate<"sessions">["type"],
        start_at: new Date(startAtLocal).toISOString(),
        end_at: new Date(endAtLocal).toISOString(),
        subject_id:
          data.type === "CLASS" || data.type === "DRAFTING"
            ? (data.subjectId ?? null)
            : null,
        class_id: data.type === "CLASS" ? (data.classId ?? null) : null,
      };
      await updateSessionMutation.mutateAsync({ id: id, data: update });
      await sessionData.refresh();
      setIsEditing(false);
      setPendingSaveData(null);
      toast({
        title: "Session updated",
        description: "Session has been updated successfully.",
      });
    } catch (err) {
      console.error("Failed to update session:", err);
      toast({
        title: "Update failed",
        description:
          err instanceof Error
            ? err.message
            : "Failed to update session. Please try again.",
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleSessionFormSubmit = async (data: SessionEditFormData) => {
    setPendingSaveData(data);
  };

  const handleMutationError = (error: unknown) =>
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Please try again.",
      variant: "destructive",
    });

  // UI state
  const [activeTab, setActiveTab] = useState("details");

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
    onEditTutorLog: modals.openEditTutorLogModal,
    hasTutorLog: helpers.hasTutorLog,
  });

  // Navigation handlers
  const handleOpenSession = (sessionId: string) => {
    modals.reset();
    setIsEditing(false);
    setPendingSaveData(null);
    setUndoTarget(null);
    setActiveTab("details");
    router.push(`/sessions/${sessionId}`);
  };

  const handleOpenStaff = (staffId: string) => {
    entityModals.openStaff(staffId);
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
    entityModals.openFilePreview(fileId);
  };

  const handleOpenClass = (classId: string) => {
    router.push(`/classes/${classId}`);
  };

  const handleMessageStudent = async (studentId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(
        studentId,
        "student",
      );
      if (conversationId) {
        openWindow({ conversationId, title: "Student" });
      }
    } catch (error) {
      console.error("Failed to open conversation:", error);
    }
  };

  const handleMessageStaff = async (staffId: string) => {
    try {
      const conversationId = await ensureConversationForRelated(
        staffId,
        "staff",
      );
      if (conversationId) {
        openWindow({ conversationId, title: "Staff" });
      }
    } catch (error) {
      console.error("Failed to open conversation:", error);
    }
  };

  if (sessionData.isLoading) {
    return <AdminLoadingSkeleton />;
  }

  if (!sessionData.data || !sessionData.data.session) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/sessions")}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            Session Not Found
          </h1>
        </div>
      </div>
    );
  }

  const {
    session,
    sessionsStudents,
    sessionsStaff,
    tutorLog,
    sessionsParents = [],
  } = sessionData.data;
  const sessionTitle = getSessionTitle(session);

  // Process attendance data
  const actualStudentAttendance = buildStudentAttendanceMap(tutorLog);
  const actualStaffAttendance = buildStaffAttendanceMap(tutorLog);

  // Process students and staff data
  const studentsData = processSessionStudents(
    sessionsStudents,
    actualStudentAttendance,
    helpers.hasTutorLog,
  );
  const staffData = processSessionStaff(
    sessionsStaff,
    actualStaffAttendance,
    helpers.hasTutorLog,
    tutorLog?.created_by ?? undefined,
  );

  const sessionShortName = getShortSessionName(session);
  const classSessions = classSessionsQuery.data?.sessions ?? [];
  const selectedClassSession =
    classSessions.find((row) => row.id === id) ?? null;
  const { previous: previousClassSession, next: nextClassSession } =
    getAdjacentSessionSiblings(classSessions, id);
  const allowAbsenceLogging = Boolean(
    session.class_id || session.admin_shift_id,
  );
  const meetingMode = session.type !== "CLASS";
  const adminMeetingMode = session.type === "ADMIN_MEETING";
  const allowAddParticipants = !helpers.hasTutorLog;
  const parentsData = sessionsParents.flatMap((row) =>
    row.parent ? [{ parent: row.parent, sessionsParentsId: row.id }] : [],
  );
  const existingStudentIds = sessionsStudents
    .map((row) => row.student_id)
    .filter((id): id is string => !!id);
  const existingStaffIds = sessionsStaff
    .map((row) => row.staff_id)
    .filter((id): id is string => !!id);
  const sessionTime = formatSessionTimeRangeForDisplay(session, formatTime);
  const sessionDay = session.start_at
    ? new Date(session.start_at).toLocaleDateString("en-AU", {
        weekday: "long",
      })
    : "Unknown day";

  const saveParticipant = async (
    save: () => Promise<unknown>,
    kind: "Student" | "Staff" | "Parent",
    person: { first_name: string | null; last_name: string | null },
  ) => {
    setIsAddingParticipant(true);
    try {
      await save();
      await sessionData.refresh();
      toast({
        title: `${kind} added`,
        description:
          `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim(),
      });
    } catch (error) {
      toast({
        title: `Failed to add ${kind.toLowerCase()}`,
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsAddingParticipant(false);
    }
  };
  const addStudent = (student: Tables<"students">) =>
    saveParticipant(
      () =>
        addStudentMutation.mutateAsync({
          sessionId: id,
          studentId: student.id,
        }),
      "Student",
      student,
    );
  const addStaff = (staff: Tables<"staff">) =>
    saveParticipant(
      () =>
        addStaffMutation.mutateAsync({
          sessionId: id,
          staffId: staff.id,
          type:
            session.type === "CHECK_IN"
              ? defaultCheckInSessionsStaffType(
                  studentsData.length > 0 || parentsData.length > 0,
                )
              : "MAIN_TUTOR",
        }),
      "Staff",
      staff,
    );
  const addParent = (parent: Tables<"parents">) =>
    saveParticipant(
      () =>
        addParentMutation.mutateAsync({ sessionId: id, parentId: parent.id }),
      "Parent",
      parent,
    );

  return (
    <div className={isEditing ? "px-4 pt-4 min-h-full flex flex-col" : "p-4"}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <PrimaryEntityBreadcrumb label={sessionTitle || undefined} />

        <IssuePill entityType="session" entityId={id} enabled />

        <ActionsMenu
          type="session"
          entityId={session.id}
          copyTagDisplayText={sessionTitle || session.id}
          {...sessionActions}
          sessionType={session.type}
          sessionStudents={studentsData.map(
            (d: {
              student: { id: string; first_name: string; last_name: string };
            }) => ({
              id: d.student.id,
              name: `${d.student.first_name} ${d.student.last_name}`,
            }),
          )}
          onSendBookingConfirmation={modals.openBookingConfirmationDialog}
        />
      </div>

      {/* Sections */}
      <SegmentedTabPanel
        value={activeTab}
        onValueChange={setActiveTab}
        className={isEditing ? "space-y-6 flex-1" : "space-y-6"}
        options={[
          { value: "details", label: "Details" },
          { value: "activity", label: "Activity" },
        ]}
      >
        <SegmentedTabPanelContent
          when="details"
          activeTab={activeTab}
          className="space-y-6"
        >
          <SessionDetailsTab
            key={`session-details-${id}-${isEditing}`}
            session={session}
            dayNavigation={
              classId ? (
                <div className="flex flex-wrap items-center gap-1">
                  {previousClassSession ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-14 flex-col gap-0.5 py-1"
                      onClick={() => handleOpenSession(previousClassSession.id)}
                      aria-label="Previous session in class"
                      title={`Previous session: ${getSessionNavigationLabel(previousClassSession)}`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="text-[10px] font-normal leading-none text-muted-foreground">
                        {formatSessionNavigationDate(
                          previousClassSession.start_at,
                        )}
                      </span>
                    </Button>
                  ) : null}
                  <div className="min-w-0">
                    <SearchableSelect<Tables<"sessions">>
                      items={classSessions}
                      value={selectedClassSession}
                      onValueChange={(selectedSession) => {
                        if (selectedSession)
                          handleOpenSession(selectedSession.id);
                      }}
                      getItemId={(classSession) => classSession.id}
                      getItemLabel={getSessionNavigationLabel}
                      getItemValue={(classSession) =>
                        [
                          getSessionNavigationLabel(classSession),
                          classSession.long_name,
                          classSession.short_name,
                        ]
                          .filter(Boolean)
                          .join(" ")
                      }
                      searchPlaceholder="Search session dates or times…"
                      emptyMessage="No class sessions found."
                      loading={classSessionsQuery.isLoading}
                      disabled={
                        classSessionsQuery.isLoading ||
                        classSessions.length === 0
                      }
                      contentWidth="280px"
                      align="end"
                      trigger={
                        <SearchableSelectFieldTrigger
                          className="h-10 max-w-full px-2 text-sm"
                          aria-label="Select class session"
                        >
                          {session.start_at
                            ? formatSessionLongDate(session.start_at)
                            : "—"}
                        </SearchableSelectFieldTrigger>
                      }
                    />
                  </div>
                  {nextClassSession ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-14 flex-col gap-0.5 py-1"
                      onClick={() => handleOpenSession(nextClassSession.id)}
                      aria-label="Next session in class"
                      title={`Next session: ${getSessionNavigationLabel(nextClassSession)}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span className="text-[10px] font-normal leading-none text-muted-foreground">
                        {formatSessionNavigationDate(nextClassSession.start_at)}
                      </span>
                    </Button>
                  ) : null}
                </div>
              ) : null
            }
            studentsData={studentsData}
            staffData={staffData}
            tutorLog={tutorLog}
            allTopics={sessionData.allTopics}
            sessionId={id}
            isSessionInPast={helpers.isSessionInPast}
            currentStaff={currentStaff ?? null}
            onOpenSession={handleOpenSession}
            onOpenStudent={entityModals.openStudent}
            onOpenStaff={handleOpenStaff}
            onOpenParent={entityModals.openParent}
            onOpenClass={handleOpenClass}
            onMessageStudent={handleMessageStudent}
            onMessageStaff={handleMessageStaff}
            onOpenTopic={handleOpenTopic}
            onOpenFile={handleOpenFile}
            onLogAbsenceStudent={
              currentStaff && allowAbsenceLogging
                ? modals.openLogStudentAbsenceDialog
                : undefined
            }
            onLogAbsenceStaff={
              currentStaff && allowAbsenceLogging
                ? modals.openLogStaffAbsenceDialog
                : undefined
            }
            onRemoveParentFromSession={(parentId, parentName) =>
              modals.openRemoveFromSessionDialog({
                entityType: "parent",
                entityId: parentId,
                entityName: parentName,
              })
            }
            onRemoveStudentFromSession={(studentId, studentName) =>
              modals.openRemoveFromSessionDialog({
                entityType: "student",
                entityId: studentId,
                entityName: studentName,
              })
            }
            onRemoveStaffFromSession={(staffId, staffName) =>
              modals.openRemoveFromSessionDialog({
                entityType: "staff",
                entityId: staffId,
                entityName: staffName,
              })
            }
            meetingMode={meetingMode}
            adminMeetingMode={adminMeetingMode}
            parentsData={parentsData}
            isEditing={isEditing}
            onEdit={() => setIsEditing(true)}
            onCancelEdit={() => setIsEditing(false)}
            onSubmit={handleSessionFormSubmit}
            isUpdating={updateSessionMutation.isPending || isAddingParticipant}
            onUndoLogAbsenceStudent={
              allowAbsenceLogging
                ? (payload) => {
                    type SessionsStudentRowWithId = {
                      sessions_students_id?: string;
                      id?: string;
                      rescheduled_session?: { session?: unknown };
                    };
                    const sourceRow = (
                      sessionsStudents as SessionsStudentRowWithId[]
                    ).find(
                      (row) =>
                        (row.sessions_students_id || row.id) ===
                        payload.sessionsStudentsId,
                    );
                    const rescheduledSession =
                      sourceRow?.rescheduled_session?.session;

                    setUndoTarget({
                      entityType: "student",
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
                      entityType: "staff",
                      staffId: payload.staffId,
                      staffName: payload.staffName,
                      sessionsStaffId: payload.sessionsStaffId,
                      action: payload.action,
                      swappedStaffName: payload.swappedStaffName,
                    });
                  }
                : undefined
            }
            onAddStudentToSession={
              !meetingMode && allowAddParticipants
                ? modals.openAddStudentToSessionModal
                : undefined
            }
            onAddStaffToSession={
              !meetingMode && allowAddParticipants
                ? modals.openAddStaffToSessionModal
                : undefined
            }
            onMeetingAddStudent={
              meetingMode && !adminMeetingMode && allowAddParticipants
                ? (student) => addStudent(student).catch(() => undefined)
                : undefined
            }
            onMeetingAddStaff={
              meetingMode && allowAddParticipants
                ? (staff) => addStaff(staff).catch(() => undefined)
                : undefined
            }
            onMeetingAddParent={
              meetingMode && !adminMeetingMode
                ? (parent) => addParent(parent).catch(() => undefined)
                : undefined
            }
          />
          {meetingMode && <SessionFiles sessionId={id} />}
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent
          when="activity"
          activeTab={activeTab}
          className="space-y-6"
        >
          <SessionActivityTab sessionId={id} isOpen={true} />
        </SegmentedTabPanelContent>
      </SegmentedTabPanel>

      {isEditing && activeTab === "details" && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-auto flex justify-end gap-2 border-t bg-background px-4 py-4">
          <Button
            variant="outline"
            disabled={updateSessionMutation.isPending}
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="session-edit-form"
            disabled={updateSessionMutation.isPending}
          >
            Save Changes
          </Button>
        </div>
      )}
      {/* Save confirmation dialog */}
      <AlertDialog
        open={!!pendingSaveData}
        onOpenChange={(open) => !open && setPendingSaveData(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save session changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save these changes to the session? This
              will update the session type, date, time, subject, and/or class.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (pendingSaveData) {
                  await handleSessionUpdate(pendingSaveData).catch(
                    () => undefined,
                  );
                }
              }}
              disabled={updateSessionMutation.isPending}
            >
              {updateSessionMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Tutor Log Modal */}
      {tutorLog?.id && modals.isEditTutorLogModalOpen && (
        <EditTutorLogDialog
          tutorLogId={tutorLog.id}
          isOpen={modals.isEditTutorLogModalOpen}
          onClose={async () => {
            modals.closeEditTutorLogModal();
            if (id) {
              await sessionData.refresh();
            }
          }}
          onTutorLogUpdated={async () => {
            if (id) {
              await sessionData.refresh();
            }
          }}
        />
      )}

      {modals.removeFromSessionTarget && (
        <RemoveFromSessionConfirmDialog
          isOpen={modals.isRemoveFromSessionDialogOpen}
          entityType={modals.removeFromSessionTarget.entityType}
          entityName={modals.removeFromSessionTarget.entityName}
          sessionTitle={sessionTitle}
          isPending={
            removeStudentMutation.isPending ||
            removeStaffMutation.isPending ||
            removeParentMutation.isPending
          }
          onCancel={modals.closeRemoveFromSessionDialog}
          onConfirm={async () => {
            if (!id || !modals.removeFromSessionTarget) return;
            const target = modals.removeFromSessionTarget;
            try {
              if (target.entityType === "student") {
                await removeStudentMutation.mutateAsync({
                  sessionId: id,
                  studentId: target.entityId,
                });
              } else if (target.entityType === "staff") {
                await removeStaffMutation.mutateAsync({
                  sessionId: id,
                  staffId: target.entityId,
                });
              } else {
                await removeParentMutation.mutateAsync({
                  sessionId: id,
                  parentId: target.entityId,
                });
              }
              await sessionData.refresh();
              modals.closeRemoveFromSessionDialog();
              toast({
                title: `${target.entityType === "student" ? "Student" : target.entityType === "staff" ? "Staff" : "Parent"} removed`,
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
            undoTarget.entityType === "student"
              ? `Mark ${undoTarget.studentName} as attending ${sessionShortName}?`
              : `Mark ${undoTarget.staffName} as attending ${sessionShortName}?`
          }
          secondaryDescription={
            undoTarget.entityType === "student" &&
            undoTarget.action === "reschedule" &&
            undoTarget.rescheduledSessionTitle
              ? `This will remove them from the rescheduled session ${undoTarget.rescheduledSessionTitle}.`
              : undoTarget.entityType === "staff" &&
                  undoTarget.action === "swap" &&
                  undoTarget.swappedStaffName
                ? `This will remove replacement staff ${undoTarget.swappedStaffName} from this session.`
                : undefined
          }
          confirmLabel="Undo Log Absence"
          isPending={
            undoAbsenceMutation.isPending || undoStaffAbsenceMutation.isPending
          }
          onCancel={() => setUndoTarget(null)}
          onConfirm={async () => {
            try {
              if (undoTarget.entityType === "student") {
                const result = await undoAbsenceMutation.mutateAsync({
                  staffId: currentStaff.id,
                  operations: [
                    {
                      student_id: undoTarget.studentId,
                      original_sessions_students_id:
                        undoTarget.sessionsStudentsId,
                      action: undoTarget.action,
                    },
                  ],
                });

                if (!result.success) {
                  toast({
                    title: "Error",
                    description: result.error || "Failed to undo absence",
                    variant: "destructive",
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
                    title: "Error",
                    description: result.error || "Failed to undo staff absence",
                    variant: "destructive",
                  });
                  return;
                }
              }

              await sessionData.refresh();
              setUndoTarget(null);
              toast({
                title: "Absence undone",
                description: "Attendance has been restored for this session.",
              });
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Failed to undo absence";
              toast({
                title: "Error",
                description: message,
                variant: "destructive",
              });
            }
          }}
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
            isPending={isAddingParticipant}
            onConfirm={addStudent}
          />
          <AddStaffToSessionModal
            isOpen={modals.isAddStaffToSessionModalOpen}
            onClose={modals.closeAddStaffToSessionModal}
            sessionTitle={sessionTitle}
            sessionTime={sessionTime}
            sessionDay={sessionDay}
            existingStaffIds={existingStaffIds}
            isPending={isAddingParticipant}
            onConfirm={addStaff}
          />
        </>
      )}

      {currentStaff &&
        modals.isLogStudentAbsenceDialogOpen &&
        modals.selectedStudentForAbsence && (
          <LogAbsenceDialog
            key={`${id}-${modals.selectedStudentForAbsence}`}
            isOpen
            onClose={async () => {
              modals.closeLogStudentAbsenceDialog();
              await sessionData.refresh();
            }}
            staffId={currentStaff.id}
            initialStudentId={modals.selectedStudentForAbsence}
            initialSessionId={id}
            allowPastSessions
          />
        )}
      {currentStaff &&
        modals.isLogStaffAbsenceDialogOpen &&
        modals.selectedStaffForAbsence && (
          <LogStaffAbsenceDialog
            key={`${id}-${modals.selectedStaffForAbsence}`}
            isOpen
            onClose={async () => {
              modals.closeLogStaffAbsenceDialog();
              await sessionData.refresh();
            }}
            staffId={currentStaff.id}
            initialStaffId={modals.selectedStaffForAbsence}
            initialSessionId={id}
            allowPastSessions
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
          initialSessionKind={
            sessionData.data?.session?.type !== "CLASS" ? "meeting" : "class"
          }
        />
      )}

      {/* Booking Confirmation Dialog */}
      {modals.selectedStudentForBookingConfirmation && (
        <SendBookingConfirmationDialog
          isOpen={modals.isBookingConfirmationDialogOpen}
          onClose={modals.closeBookingConfirmationDialog}
          sessionId={id}
          studentId={modals.selectedStudentForBookingConfirmation}
        />
      )}
    </div>
  );
}
