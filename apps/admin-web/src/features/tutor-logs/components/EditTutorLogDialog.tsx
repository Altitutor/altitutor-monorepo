'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { SearchableSelect } from '@altitutor/ui';
import { Separator } from '@altitutor/ui';
import { SegmentedControl, SegmentedTabPanelContent } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { useTutorLog, useUpdateTutorLog } from '../hooks/useTutorLogsQuery';
import { staffApi } from '@/features/staff/api/staff';
import { sessionsApi } from '@/features/sessions/api/sessions';
import type { TutorLogFormData } from '../types';
import { Step2StaffAttendance } from './steps/Step2StaffAttendance';
import { Step3StudentAttendance } from './steps/Step3StudentAttendance';
import { Step4Topics } from './steps/Step4Topics';
import { Step5TopicStudents } from './steps/Step5TopicStudents';
import { Step6Files } from './steps/Step6Files';
import { Step7FileStudents } from './steps/Step7FileStudents';
import { getAttendedStudentIds } from '../utils/logSessionHelpers';
import { AdminDialogShell } from '@/shared/components';

interface EditTutorLogDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tutorLogId: string;
  onTutorLogUpdated?: () => void;
}

export function EditTutorLogDialog({
  isOpen,
  onClose,
  tutorLogId,
  onTutorLogUpdated,
}: EditTutorLogDialogProps) {
  const { data: tutorLog, isLoading: isLoadingTutorLog } = useTutorLog(tutorLogId, isOpen);
  const updateMutation = useUpdateTutorLog();
  const [staffList, setStaffList] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [isStaffLoaded, setIsStaffLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('attendance');
  const [createdBy, setCreatedBy] = useState<string>('');
  const [formData, setFormData] = useState<Partial<TutorLogFormData>>({});
  const [isFormDataReady, setIsFormDataReady] = useState(false);

  // Load staff list
  useEffect(() => {
    if (isOpen) {
      setIsStaffLoaded(false);
      staffApi.listMinimal({ limit: 1000, orderBy: 'first_name', ascending: true })
        .then((result) => {
          setStaffList(result.staff.map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
          })));
          setIsStaffLoaded(true);
        })
        .catch((err) => {
          console.error('Failed to load staff list:', err);
          setIsStaffLoaded(true);
        });
    } else {
      setIsStaffLoaded(false);
    }
  }, [isOpen]);

  // Initialize all form data when both tutor log and staff list are loaded
  useEffect(() => {
    if (isOpen && tutorLog && isStaffLoaded) {
      setCreatedBy(tutorLog.created_by || '');

      setFormData({
        sessionId: tutorLog.session_id,
        staffAttendance: (tutorLog.staffAttendance ?? []).map((sa) => ({
          staffId: sa.staff_id,
          attended: sa.attended === true,
          type: (sa.type || 'SECONDARY_TUTOR') as 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR',
        })),
        studentAttendance: (tutorLog.studentAttendance ?? []).map((sa) => ({
          studentId: sa.student_id,
          attended: sa.attended === true,
        })),
        parentAttendance: (tutorLog.parentAttendance ?? []).map((pa) => ({
          parentId: pa.parent_id,
          attended: pa.attended === true,
        })),
        topics: (tutorLog.topics ?? []).map((t) => ({
          topicId: t.topic_id,
          studentIds: (t.students ?? []).map((s) => s.student_id),
        })),
        topicFiles: (tutorLog.topicFiles ?? []).map((tf) => ({
          topicsFilesId: tf.topicFile.id,
          topicId: tf.topicFile.topic_id,
          studentIds: (tf.students ?? []).map((s) => s.student_id),
        })),
        notes: [],
      });

      setIsFormDataReady(true);
    } else if (!isOpen) {
      setCreatedBy('');
      setFormData({});
      setIsFormDataReady(false);
    }
  }, [isOpen, tutorLog, isStaffLoaded, staffList.length]);

  const updateFormData = (updates: Partial<TutorLogFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleAddStaffToSession = useCallback(
    async (staffId: string) => {
      if (!tutorLog?.session_id) return;
      await sessionsApi.assignStaffToSession(tutorLog.session_id, staffId);
    },
    [tutorLog?.session_id]
  );

  const handleAddStudentToSession = useCallback(
    async (studentId: string) => {
      if (!tutorLog?.session_id) return;
      await sessionsApi.addStudentToSession(tutorLog.session_id, studentId);
    },
    [tutorLog?.session_id]
  );

  const handleAddParentToSession = useCallback(
    async (parentId: string) => {
      if (!tutorLog?.session_id) return;
      await sessionsApi.addParentToSession(tutorLog.session_id, parentId);
    },
    [tutorLog?.session_id]
  );

  const handleRemoveStaffFromSession = useCallback(
    async (staffId: string) => {
      if (!tutorLog?.session_id) return;
      await sessionsApi.removeStaffFromSession(tutorLog.session_id, staffId);
    },
    [tutorLog?.session_id]
  );

  const handleRemoveStudentFromSession = useCallback(
    async (studentId: string) => {
      if (!tutorLog?.session_id) return;
      await sessionsApi.removeStudentFromSession(tutorLog.session_id, studentId);
    },
    [tutorLog?.session_id]
  );

  const isClassSessionType = tutorLog?.session?.type === 'CLASS';

  useEffect(() => {
    if (!isClassSessionType && activeTab !== 'attendance') {
      setActiveTab('attendance');
    }
  }, [isClassSessionType, activeTab]);

  const handleSubmit = async () => {
    if (!tutorLog || !formData.sessionId || !createdBy) return;

    try {
      await updateMutation.mutateAsync({
        id: tutorLogId,
        data: {
          sessionId: formData.sessionId,
          staffAttendance: formData.staffAttendance || [],
          studentAttendance: formData.studentAttendance || [],
          parentAttendance: formData.parentAttendance || [],
          topics: formData.topics || [],
          topicFiles: formData.topicFiles || [],
          notes: formData.notes ?? [],
        },
        createdBy,
      });

      onTutorLogUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error updating tutor log:', error);
    }
  };

  const handleClose = () => {
    setCreatedBy('');
    setFormData({});
    setActiveTab('attendance');
    setIsFormDataReady(false);
    onClose();
  };

  const isLoading = isLoadingTutorLog || !isStaffLoaded || updateMutation.isPending;

  if (isLoadingTutorLog || !isStaffLoaded) {
    return (
      <AdminDialogShell
        fillHeight
        open={isOpen}
        onClose={handleClose}
        title="Edit Tutor Log"
        subtitle="Loading tutor log and staff list."
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminDialogShell>
    );
  }

  if (!tutorLog) {
    return (
      <AdminDialogShell
        fillHeight
        open={isOpen}
        onClose={handleClose}
        title="Edit Tutor Log"
        subtitle="Tutor log could not be loaded."
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Tutor log not found</p>
        </div>
      </AdminDialogShell>
    );
  }

  const sessionId = tutorLog.session_id;
  const isClassSession = tutorLog.session?.type === 'CLASS';

  return (
    <AdminDialogShell
      fillHeight
      open={isOpen}
      onClose={handleClose}
      title="Edit Tutor Log"
      subtitle={
        isClassSession
          ? 'Edit attendance, topics, and files for this tutor log.'
          : 'Edit attendance for this tutor log.'
      }
      contentClassName="md:max-w-4xl"
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      headerExtra={
        <div className="border-b bg-background px-6 pb-4">
          <SegmentedControl
            fullWidth
            value={activeTab}
            onValueChange={setActiveTab}
            options={[
              { value: 'attendance', label: 'Attendance' },
              ...(isClassSession
                ? [
                    { value: 'topics', label: 'Topics' },
                    { value: 'files', label: 'Files' },
                  ]
                : []),
            ]}
          />
        </div>
      }
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !createdBy}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
            <SegmentedTabPanelContent when="attendance" activeTab={activeTab} className="absolute inset-0 overflow-y-auto">
              <div className="p-6 space-y-8">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Created by</h3>
                  <div className="space-y-2 max-w-md">
                    <Label>Staff member</Label>
                    <SearchableSelect<{ id: string; first_name: string; last_name: string }>
                      items={staffList}
                      value={staffList.find((s) => s.id === createdBy) ?? null}
                      onValueChange={(item) => item && setCreatedBy(item.id)}
                      getItemLabel={(s) => `${s.first_name} ${s.last_name}`}
                      getItemId={(s) => s.id}
                      placeholder="Select staff member"
                      triggerClassName="w-full min-w-0 max-w-full"
                    />
                    {!createdBy && (
                      <p className="text-sm text-destructive">Created by is required</p>
                    )}
                  </div>
                </section>

                <Separator />

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Staff</h3>
                  {sessionId && isFormDataReady && (
                    <Step2StaffAttendance
                      sessionId={sessionId}
                      currentStaffId={createdBy}
                      staffAttendance={formData.staffAttendance || []}
                      onUpdate={(staffAttendance) => updateFormData({ staffAttendance })}
                      onAddStaffToSession={handleAddStaffToSession}
                      onRemoveStaffFromSession={async (staffId) => {
                        await handleRemoveStaffFromSession(staffId);
                        updateFormData({
                          staffAttendance: (formData.staffAttendance || []).filter(
                            (a) => a.staffId !== staffId
                          ),
                        });
                      }}
                      addStaffVariant="search"
                    />
                  )}
                </section>

                <Separator />

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Students</h3>
                  {sessionId && isFormDataReady && (
                    <Step3StudentAttendance
                      sessionId={sessionId}
                      sessionType={tutorLog.session?.type}
                      sessionParents={(tutorLog.session?.sessions_parents ?? []).map((row) => ({
                        ...row.parent,
                        sessions_parents_id: row.id,
                      }))}
                      studentAttendance={formData.studentAttendance || []}
                      parentAttendance={formData.parentAttendance ?? []}
                      onUpdate={(studentAttendance) => updateFormData({ studentAttendance })}
                      onParentAttendanceUpdate={(parentAttendance) =>
                        updateFormData({ parentAttendance })
                      }
                      addStudentVariant="search"
                      onAddStudentToSession={handleAddStudentToSession}
                      onRemoveStudentFromSession={async (studentId) => {
                        await handleRemoveStudentFromSession(studentId);
                        updateFormData({
                          studentAttendance: (formData.studentAttendance || []).filter(
                            (a) => a.studentId !== studentId
                          ),
                        });
                      }}
                      onAddParentToSession={handleAddParentToSession}
                      section="students"
                    />
                  )}
                </section>

                {tutorLog.session?.type && tutorLog.session.type !== 'CLASS' ? (
                  <>
                    <Separator />
                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">Parents</h3>
                      {sessionId && isFormDataReady && (
                        <Step3StudentAttendance
                          sessionId={sessionId}
                          sessionType={tutorLog.session?.type}
                          sessionParents={(tutorLog.session?.sessions_parents ?? []).map((row) => ({
                            ...row.parent,
                            sessions_parents_id: row.id,
                          }))}
                          studentAttendance={formData.studentAttendance || []}
                          parentAttendance={formData.parentAttendance ?? []}
                          onUpdate={(studentAttendance) => updateFormData({ studentAttendance })}
                          onParentAttendanceUpdate={(parentAttendance) =>
                            updateFormData({ parentAttendance })
                          }
                          addStudentVariant="search"
                          onAddStudentToSession={handleAddStudentToSession}
                          onAddParentToSession={handleAddParentToSession}
                          section="parents"
                        />
                      )}
                    </section>
                  </>
                ) : null}
              </div>
            </SegmentedTabPanelContent>

            {isClassSession ? (
              <>
                <SegmentedTabPanelContent when="topics" activeTab={activeTab} className="absolute inset-0 overflow-y-auto">
                  <div className="p-6 space-y-4">
                    {sessionId && isFormDataReady && (
                      <>
                        <Step4Topics
                          sessionId={sessionId}
                          topics={formData.topics || []}
                          onUpdate={(topics) => updateFormData({ topics })}
                        />
                        <Step5TopicStudents
                          topics={formData.topics || []}
                          attendedStudentIds={getAttendedStudentIds(formData)}
                          onUpdate={(topics) => updateFormData({ topics })}
                        />
                      </>
                    )}
                  </div>
                </SegmentedTabPanelContent>

                <SegmentedTabPanelContent when="files" activeTab={activeTab} className="absolute inset-0 overflow-y-auto">
                  <div className="p-6 space-y-4">
                    {sessionId && isFormDataReady && (
                      <>
                        <Step6Files
                          topics={formData.topics || []}
                          topicFiles={formData.topicFiles || []}
                          onUpdate={(topicFiles) => updateFormData({ topicFiles })}
                        />
                        <Step7FileStudents
                          topics={formData.topics || []}
                          topicFiles={formData.topicFiles || []}
                          onUpdate={(topicFiles) => updateFormData({ topicFiles })}
                        />
                      </>
                    )}
                  </div>
                </SegmentedTabPanelContent>
              </>
            ) : null}
        </div>
      </div>
    </AdminDialogShell>
  );
}
