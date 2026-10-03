'use client';
import { PrimaryEntityBreadcrumb } from '@/shared/components/PrimaryEntityBreadcrumb';
import { StudentOnlineTab } from '@/features/students/components/StudentOnlineTab';
import { useAdminPageViewParam } from '@/shared/hooks/useAdminPageViewParam';

import { NoteAlertPills } from '@/shared/components/NoteAlertPills';
import { useState } from 'react';
import { useCanonicalStudentId } from '@/features/student-merges/useCanonicalStudentId';
import { useRouter } from 'next/navigation';
import { SegmentedTabPanel, SegmentedTabPanelContent } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useCurrentStaff } from '@/shared/hooks';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { LogAbsenceDialog } from '@/features/sessions/components/absences/LogAbsenceDialog';
import { BookSessionModal } from '@/features/bookings/components/BookSessionModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { useStudentDetails } from '@/features/students/hooks/useStudentsQuery';
import { useQueryClient } from '@tanstack/react-query';
import { 
  DetailsTab,
  ClassesTab,
  DetailsFormData
} from '@/features/students/components/tabs';
import { StudentSessionsTab } from '@/features/students/components/StudentSessionsTab';
import { StudentBillingTab } from '@/features/students/components/StudentBillingTab';
import { StudentFiles } from '@/features/students/components/StudentFiles';
import { ParentSearchPopover } from '@/features/students/components/ParentSearchPopover';
import { EntityCommunicationPanel } from '@/features/activity/components/EntityCommunicationPanel';
import {
  useStudentEditFlow,
  useStudentMutations,
  useStudentModals,
  useAllParents,
  useStudentActions,
} from '@/features/students/hooks';
import { EnrollStudentModal } from '@/features/enrollments/components/EnrollStudentModal';
import { classesApi } from '@/shared/api';
import { useStudentClasses } from '@/features/students/hooks/useStudentClasses';
import { currentEnrolledClassIds } from '@/features/students/utils/classEnrollments';
import { useToast } from '@altitutor/ui';
import type { ClassWithExpandedSubject } from '@altitutor/shared';
import { StudentExitRequestDialog } from '@/features/forms/components/StudentExitRequestDialog';
import { DiscontinueStudentConfirmDialog } from '@/features/students/components/DiscontinueStudentConfirmDialog';
import { ReEnrollStudentConfirmDialog } from '@/features/students/components/ReEnrollStudentConfirmDialog';
import { studentsApi } from '@/features/students/api';
import { AdminLoadingSkeleton } from '@/shared/components';
import { useEntityNavigation } from '@/shared/contexts/EntityNavigation';
import {
  invalidateStudentClassSurfaces,
  invalidateStudentDetail,
} from '@/shared/lib/query-invalidation';

export default function StudentDetailPage({ params }: { params: { id: string } }) {
  const id = useCanonicalStudentId(params.id) ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  const { toast } = useToast();
  const { openCheckInModal } = useQuickActions();
  const entityModals = useEntityNavigation();

  // Data fetching
  const { data: studentDetails, isLoading: loadingStudent } = useStudentDetails(id, !!id);
  const student = studentDetails?.student || null;
  const studentSubjects = studentDetails?.subjects || [];
  const parents = studentDetails?.parents || [];

  // Business logic hooks
  const editFlow = useStudentEditFlow({
    initialSubjects: studentSubjects,
    initialParents: parents,
  });

  const mutations = useStudentMutations({
    studentId: id,
    onSuccess: () => {
      void invalidateStudentDetail(queryClient, id);
      editFlow.reset();
    },
  });

  const modals = useStudentModals();

  const { data: allParentsData } = useAllParents({
    enabled: editFlow.isEditing,
  });
  const allParents = allParentsData || [];

  // Get student classes for enroll modal
  const { data: studentClasses = [] } = useStudentClasses(id);

  // UI state
  const [activeTab, setActiveTab] = useAdminPageViewParam(['details', 'online', 'classes', 'activity', 'sessions', 'files', 'billing'] as const, 'details', 'tab');
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isDiscontinueDialogOpen, setIsDiscontinueDialogOpen] = useState(false);
  const [isDiscontinuationLinkOpen, setIsDiscontinuationLinkOpen] = useState(false);
  const [isDiscontinuing, setIsDiscontinuing] = useState(false);
  const [isReEnrollDialogOpen, setIsReEnrollDialogOpen] = useState(false);
  const [isReEnrolling, setIsReEnrolling] = useState(false);

  // Handle details submit
  const handleDetailsSubmit = async (data: DetailsFormData) => {
    if (!student) return;

    await mutations.updateDetails(
      data,
      {
        toAdd: editFlow.subjectsToAdd,
        toRemove: editFlow.subjectsToRemove,
      },
      {
        toAdd: editFlow.parentsToAdd,
        toRemove: editFlow.parentsToRemove,
      }
    );
  };

  // Handle student deletion
  const handleDeleteStudent = async () => {
    if (!student) return;

    try {
      await mutations.deleteStudent();
      modals.closeDeleteDialog();
      router.push('/students');
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleStudentUpdated = () => {
    void invalidateStudentDetail(queryClient, id);
  };

  // Handle enrollment
  const handleEnroll = async (params: {
    studentId: string;
    classId: string;
    enrolledAt: Date;
    staffId: string;
  }) => {
    try {
      await classesApi.enrollStudent(params.classId, params.studentId, params.enrolledAt, params.staffId);
      await invalidateStudentClassSurfaces(queryClient, id);
      setIsEnrollModalOpen(false);
      handleStudentUpdated();
      toast({
        title: 'Success',
        description: 'Student enrolled successfully.',
      });
    } catch (err) {
      console.error('Failed to enroll student:', err);
      toast({
        title: 'Enrollment failed',
        description: 'There was an error enrolling the student. Please try again.',
        variant: 'destructive',
      });
      throw err;
    }
  };

  // Fetch classes for enrollment modal
  const fetchClassesForEnrollment = async (): Promise<ClassWithExpandedSubject[]> => {
    const { classes, classSubjects, classStaff, classStudents } = await classesApi.getAllClassesWithDetails();
    return classes.map(c => {
      return {
        ...c,
        subject: classSubjects[c.id],
        staff: classStaff[c.id] || [],
        students: classStudents[c.id] || []
      } as ClassWithExpandedSubject;
    });
  };

  // Centralized action handlers
  const studentActions = useStudentActions({
    studentId: id,
    student,
    onEditDetails: () => {
      setActiveTab('details');
      editFlow.startEdit();
    },
    onLogAbsence: modals.openLogAbsence,
    onBookTrialSession: modals.openBookTrialSession,
    onBookDraftingSession: modals.openBookDraftingSession,
    onBookSubsidyInterview: modals.openBookSubsidyInterview,
    onBookCheckIn: student
      ? () =>
          openCheckInModal({
            students: [
              {
                id: student.id,
                first_name: student.first_name,
                last_name: student.last_name,
              },
            ],
          })
      : undefined,
    onSendDiscontinuationLink: () => setIsDiscontinuationLinkOpen(true),
    onDiscontinue: () => setIsDiscontinueDialogOpen(true),
    onReEnroll: () => setIsReEnrollDialogOpen(true),
    onDelete: modals.openDeleteDialog,
  });

  if (loadingStudent) {
    return <AdminLoadingSkeleton />;
  }

  if (!student) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/students')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Student Not Found</h1>
        </div>
      </div>
    );
  }

  const activityLayout = activeTab === 'activity';

  return (
    <div className={activityLayout ? 'flex h-full min-h-0 flex-col overflow-hidden' : 'p-4'}>
      {/* Header */}
      <div className={activityLayout ? 'flex shrink-0 items-center gap-2 border-b bg-background px-4 py-2' : 'mb-3 flex items-center gap-2 border-b pb-3'}>
        <PrimaryEntityBreadcrumb />
        <NoteAlertPills entityType="student" entityId={student.id} />

        <ActionsMenu
          type="student"
          entityId={student.id}
          copyTagDisplayText={`${student.first_name || ''} ${student.last_name || ''}`.trim()}
          {...studentActions}
        />
      </div>

      {/* Sections */}
      <SegmentedTabPanel
        value={activeTab}
        onValueChange={setActiveTab}
        className={activityLayout ? 'mt-3 flex min-h-0 flex-1 flex-col gap-3 px-4' : 'space-y-6'}
        selectorClassName={activityLayout ? 'px-0' : undefined}
        options={[
          { value: 'details', label: 'Details' },
          ...((studentDetails?.onlineRelationships?.length ?? 0) > 0 ? [{ value: 'online' as const, label: 'Online' }] : []),
          { value: 'classes', label: 'Classes' },
          { value: 'activity', label: 'Activity' },
          { value: 'sessions', label: 'Sessions' },
          { value: 'files', label: 'Files' },
          { value: 'billing', label: 'Billing' },
        ]}
      >
        <SegmentedTabPanelContent when="details" activeTab={activeTab} className="space-y-6">
          <DetailsTab
            student={student}
            isEditing={editFlow.isEditing}
            isLoading={mutations.isUpdatingDetails}
            onEdit={editFlow.startEdit}
            onCancelEdit={editFlow.cancelEdit}
            onSubmit={handleDetailsSubmit}
            onDelete={undefined}
            isDeleting={mutations.isDeleting}
            studentSubjects={editFlow.isEditing ? editFlow.tempStudentSubjects : studentSubjects}
            loadingSubjects={false}
            onRemoveSubject={undefined}
            onViewSubject={entityModals.openSubject}
            addSubjectButton={undefined}
            parents={editFlow.isEditing ? editFlow.tempStudentParents : parents}
            onViewParent={(parentId) => {
              entityModals.openParent(parentId, { defaultTab: 'messages' });
            }}
            onRemoveParent={editFlow.isEditing ? editFlow.removeParent : undefined}
            addParentButton={
              editFlow.isEditing ? (
                <ParentSearchPopover
                  allParents={allParents}
                  selectedParents={editFlow.tempStudentParents}
                  onSelectParent={editFlow.assignParent}
                />
              ) : undefined
            }
          />
          {editFlow.isEditing && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={editFlow.cancelEdit} disabled={mutations.isUpdatingDetails}>
                Cancel
              </Button>
              <Button 
                disabled={mutations.isUpdatingDetails}
                onClick={() => {
                  const form = document.getElementById('student-edit-form') as HTMLFormElement;
                  if (form) {
                    form.requestSubmit();
                  }
                }}
              >
                {mutations.isUpdatingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          )}
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="online" activeTab={activeTab} className="space-y-6"><StudentOnlineTab student={student} /></SegmentedTabPanelContent>
        <SegmentedTabPanelContent when="classes" activeTab={activeTab} className="space-y-6">
          <ClassesTab
            student={student}
            onStudentUpdated={handleStudentUpdated}
          />
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="sessions" activeTab={activeTab} className="space-y-6">
          <StudentSessionsTab student={student} />
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="files" activeTab={activeTab} className="space-y-6">
          <StudentFiles studentId={id} />
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="billing" activeTab={activeTab} className="space-y-6">
          <StudentBillingTab student={student} />
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="activity" activeTab={activeTab} className="-mx-4 flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityCommunicationPanel
            entityType="student"
            entityId={id}
            className="min-h-0 flex-1"
          />
        </SegmentedTabPanelContent>
      </SegmentedTabPanel>

      {/* Log Absence Dialog */}
      {currentStaff && (
        <LogAbsenceDialog
          isOpen={modals.isLogAbsenceDialogOpen}
          onClose={modals.closeLogAbsence}
          staffId={currentStaff.id}
          initialStudentId={id}
          allowPastSessions={true}
        />
      )}

      {/* Book Drafting Session Modal */}
      <BookSessionModal
        isOpen={modals.isBookTrialSessionModalOpen}
        onClose={modals.closeBookTrialSession}
        sessionType="TRIAL_SESSION"
        initialStudentId={id}
        onBookingCreated={() => {
          modals.closeBookTrialSession();
          handleStudentUpdated();
        }}
      />

      <BookSessionModal
        isOpen={modals.isBookDraftingSessionModalOpen}
        onClose={modals.closeBookDraftingSession}
        sessionType="DRAFTING"
        initialStudentId={id}
        onBookingCreated={() => {
          modals.closeBookDraftingSession();
          handleStudentUpdated();
        }}
      />

      {/* Book Subsidy Interview Modal */}
      <BookSessionModal
        isOpen={modals.isBookSubsidyInterviewModalOpen}
        onClose={modals.closeBookSubsidyInterview}
        sessionType="SUBSIDY_INTERVIEW"
        initialStudentId={id}
        onBookingCreated={() => {
          modals.closeBookSubsidyInterview();
          handleStudentUpdated();
        }}
      />

      {/* Delete Confirmation Dialog */}
      {student && (
        <AlertDialog open={modals.isDeleteDialogOpen} onOpenChange={modals.closeDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the student
                "{student.first_name} {student.last_name}" and all associated data from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteStudent}
                disabled={mutations.isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {mutations.isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Enroll Student Modal */}
      {student && currentStaff && (
        <EnrollStudentModal
          isOpen={isEnrollModalOpen}
          onClose={() => setIsEnrollModalOpen(false)}
          context="student"
          student={student}
          studentSubjects={studentSubjects}
          enrolledClassIds={currentEnrolledClassIds(studentClasses)}
          onFetchClasses={fetchClassesForEnrollment}
          onEnroll={handleEnroll}
          currentStaffId={currentStaff.id}
        />
      )}

      {/* Send Discontinuation Link Dialog */}
      {student && (
        <StudentExitRequestDialog
          open={isDiscontinuationLinkOpen}
          onOpenChange={setIsDiscontinuationLinkOpen}
          studentId={student.id}
          studentName={`${student.first_name} ${student.last_name}`}
          studentPhone={student.phone}
          workflowKey="student_discontinuation"
          onCreated={() => void invalidateStudentDetail(queryClient, student.id)}
        />
      )}

      {student && (
        <DiscontinueStudentConfirmDialog
          isOpen={isDiscontinueDialogOpen}
          onOpenChange={setIsDiscontinueDialogOpen}
          studentName={`${student.first_name} ${student.last_name}`}
          isDiscontinuing={isDiscontinuing}
          onConfirm={async () => {
            if (!currentStaff) return false;

            try {
              setIsDiscontinuing(true);
              const result = await studentsApi.discontinueStudent(student.id, currentStaff.id);
              if (!result.success) throw new Error(result.error);
              await invalidateStudentDetail(queryClient, student.id);
              toast({
                title: 'Success',
                description: 'Student discontinued successfully.',
              });
              return true;
            } catch (error) {
              toast({
                title: 'Discontinue failed',
                description: error instanceof Error ? error.message : 'There was an error discontinuing the student. Please try again.',
                variant: 'destructive',
              });
              return false;
            } finally {
              setIsDiscontinuing(false);
            }
          }}
        />
      )}

      {/* Re-enroll Confirmation Dialog */}
      {student && (
        <ReEnrollStudentConfirmDialog
          isOpen={isReEnrollDialogOpen}
          onOpenChange={setIsReEnrollDialogOpen}
          studentName={`${student.first_name} ${student.last_name}`}
          isReEnrolling={isReEnrolling}
          onConfirm={async () => {
            try {
              setIsReEnrolling(true);
              await studentsApi.reEnrollStudent(student.id);
              await invalidateStudentDetail(queryClient, student.id);
              toast({
                title: 'Success',
                description: 'Student re-enrolled successfully.',
              });
              return true;
            } catch (error) {
              toast({
                title: 'Re-enroll failed',
                description: error instanceof Error ? error.message : 'There was an error re-enrolling the student. Please try again.',
                variant: 'destructive',
              });
              return false;
            } finally {
              setIsReEnrolling(false);
            }
          }}
        />
      )}
    </div>
  );
}
