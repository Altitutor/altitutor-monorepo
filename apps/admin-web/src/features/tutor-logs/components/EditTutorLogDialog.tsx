'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@altitutor/ui';
import { Loader2, X } from 'lucide-react';
import { useTutorLog, useUpdateTutorLog } from '../hooks/useTutorLogsQuery';
import { staffApi } from '@/features/staff/api/staff';
import type { TutorLogFormData } from '../types';
import { Step2StaffAttendance } from './steps/Step2StaffAttendance';
import { Step3StudentAttendance } from './steps/Step3StudentAttendance';
import { Step4Topics } from './steps/Step4Topics';
import { Step5TopicStudents } from './steps/Step5TopicStudents';
import { Step6Files } from './steps/Step6Files';
import { Step7FileStudents } from './steps/Step7FileStudents';
import { getAttendedStudentIds } from '../utils/logSessionHelpers';

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
  const [activeTab, setActiveTab] = useState<string>('createdBy');
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
        staffAttendance: tutorLog.staffAttendance.map((sa) => ({
          staffId: sa.staff_id,
          attended: sa.attended === true,
          type: (sa.type || 'SECONDARY_TUTOR') as 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR',
        })),
        studentAttendance: tutorLog.studentAttendance.map((sa) => ({
          studentId: sa.student_id,
          attended: sa.attended === true,
        })),
        topics: tutorLog.topics.map((t) => ({
          topicId: t.topic_id,
          studentIds: t.students.map((s) => s.student_id),
        })),
        topicFiles: tutorLog.topicFiles.map((tf) => ({
          topicsFilesId: tf.topicFile.id,
          topicId: tf.topicFile.topic_id,
          studentIds: tf.students.map((s) => s.student_id),
        })),
        notes: tutorLog.notes.map((n) => n.note),
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

  const handleSubmit = async () => {
    if (!tutorLog || !formData.sessionId || !createdBy) return;

    try {
      await updateMutation.mutateAsync({
        id: tutorLogId,
        data: {
          sessionId: formData.sessionId,
          staffAttendance: formData.staffAttendance || [],
          studentAttendance: formData.studentAttendance || [],
          topics: formData.topics || [],
          topicFiles: formData.topicFiles || [],
          notes: formData.notes || [],
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
    setActiveTab('createdBy');
    setIsFormDataReady(false);
    onClose();
  };

  const isLoading = isLoadingTutorLog || !isStaffLoaded || updateMutation.isPending;

  if (isLoadingTutorLog || !isStaffLoaded) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="w-full md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Tutor Log</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!tutorLog) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="w-full md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Tutor Log</DialogTitle>
          </DialogHeader>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Tutor log not found</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const sessionId = tutorLog.session_id;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="outline"
                size="icon"
                onClick={handleClose}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <DialogTitle>Edit Tutor Log</DialogTitle>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
          {/* Sticky Header */}
          <div className="flex-shrink-0 border-b bg-background">
            <div className="px-6 pb-4">
              <TabsList className="w-full">
                <TabsTrigger value="createdBy" className="flex-1">Created By</TabsTrigger>
                <TabsTrigger value="staffAttendance" className="flex-1">Staff Attendance</TabsTrigger>
                <TabsTrigger value="studentAttendance" className="flex-1">Student Attendance</TabsTrigger>
                <TabsTrigger value="topics" className="flex-1">Topics</TabsTrigger>
                <TabsTrigger value="files" className="flex-1">Files</TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 min-h-0 relative">
            <TabsContent value="createdBy" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
              <div className="p-6">
                <div className="space-y-2">
                  <Label>Created By</Label>
                  <Select
                    value={createdBy}
                    onValueChange={setCreatedBy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.first_name} {staff.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!createdBy && (
                    <p className="text-sm text-destructive">Created by is required</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="staffAttendance" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
              <div className="p-6">
                {sessionId && isFormDataReady && (
                  <Step2StaffAttendance
                    sessionId={sessionId}
                    currentStaffId={createdBy}
                    staffAttendance={formData.staffAttendance || []}
                    onUpdate={(staffAttendance) => updateFormData({ staffAttendance })}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="studentAttendance" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
              <div className="p-6">
                {sessionId && isFormDataReady && (
                  <Step3StudentAttendance
                    sessionId={sessionId}
                    studentAttendance={formData.studentAttendance || []}
                    onUpdate={(studentAttendance) => updateFormData({ studentAttendance })}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="topics" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
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
            </TabsContent>

            <TabsContent value="files" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
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
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
