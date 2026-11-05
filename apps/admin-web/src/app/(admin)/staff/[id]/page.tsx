'use client';
import { RetainedDeletionMessage } from "@/shared/components/RetainedDeletionMessage";

import { IssuePill } from '@/features/issues';
import { PrimaryEntityBreadcrumb } from '@/shared/components/PrimaryEntityBreadcrumb';
import { StaffPayTierTab } from '@/features/staff/components/modal/tabs/StaffPayTierTab';
import { useAdminPageViewParam } from '@/shared/hooks/useAdminPageViewParam';

import { StaffWebsiteProfile } from '@/features/staff/components/StaffWebsiteProfile';
import { NoteAlertPills } from '@/shared/components/NoteAlertPills';
import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedTabPanel, SegmentedTabPanelContent } from "@altitutor/ui";
import { Button as UIButton } from "@altitutor/ui";
import { Loader2, ArrowLeft, PanelRight } from "lucide-react";
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { AdminPageActions } from '@/shared/components/AdminPageActions';
import { useStaffActions } from '@/features/staff/hooks/useStaffActions';
import { useCurrentStaff } from '@/shared/hooks';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { LogStaffAbsenceDialog } from '@/features/sessions/components/absences/LogStaffAbsenceDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Label,
  Input,
} from "@altitutor/ui";
import { useStaffDetails } from '@/features/staff/hooks/useStaffQuery';
import { useSubjects } from '@/features/subjects';
import { useQueryClient } from '@tanstack/react-query';
import { StaffDetailsTab, StaffDetailsFormData } from '@/features/staff/components/modal/tabs/StaffDetailsTab';
import { ClassesTab } from '@/features/staff/components/modal/tabs/ClassesTab';
import { StaffSessionsTab } from '@/features/staff/components/modal/tabs/StaffSessionsTab';
import { EntityCommunicationPanel } from '@/features/activity/components/EntityCommunicationPanel';
import { SubjectSearchPopover } from '@/features/subjects/components';
import { StaffFiles } from '@/features/staff/components/StaffFiles';
import {
  useStaffEditFlow,
  useStaffMutations,
  useStaffModals,
} from '@/features/staff/hooks';
import { AdminLoadingSkeleton } from '@/shared/components';
import { useEntityNavigation } from '@/shared/contexts/EntityNavigation';
import { invalidateStaffDetail } from '@/shared/lib/query-invalidation';

export default function StaffDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  const { openCheckInModal } = useQuickActions();
  const entityModals = useEntityNavigation();

  // Data fetching
  const { data: staffData, isLoading } = useStaffDetails(id, !!id);
  const { data: allSubjects = [] } = useSubjects();

  const staffMember = staffData?.staff || null;
  const staffSubjects = staffData?.subjects || [];
  const staffFullName = staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : '';

  // Business logic hooks
  const editFlow = useStaffEditFlow({
    initialSubjects: staffSubjects,
  });

  const mutations = useStaffMutations({
    staffId: id,
    onSuccess: () => {
      void invalidateStaffDetail(queryClient, id);
      editFlow.reset();
    },
  });

  const modals = useStaffModals();

  // Centralized action handlers
  const staffActions = useStaffActions({
    staffId: id,
    onEditDetails: () => {
      editFlow.startEdit();
    },
    onLogAbsence: modals.openLogAbsence,
    onBookCheckIn: staffMember
      ? () =>
          openCheckInModal({
            staff: [
              {
                id: staffMember.id,
                first_name: staffMember.first_name,
                last_name: staffMember.last_name,
              },
            ],
          })
      : undefined,
    onDelete: modals.openDeleteDialog,
  });

  // UI state
  const [activeTab, setActiveTab] = useAdminPageViewParam(['activity', 'pay-tier', 'website', 'classes', 'sessions', 'files'] as const, 'activity', 'tab');
  const [sidebarRoot, setSidebarRoot] = useState<HTMLDivElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (!sidebarRoot) return;
    let wasNarrow: boolean | undefined;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width < 1000;
      setNarrow(next);
      if (next !== wasNarrow) setSidebarOpen(!next);
      wasNarrow = next;
    });
    observer.observe(sidebarRoot);
    return () => observer.disconnect();
  }, [sidebarRoot]);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Handle details submit
  const handleDetailsSubmit = async (data: StaffDetailsFormData) => {
    if (!staffMember) return;

    await mutations.updateDetails(
      data,
      {
        toAdd: editFlow.subjectsToAdd,
        toRemove: editFlow.subjectsToRemove,
      }
    );
  };

  // Handle delete with navigation
  const handleDelete = async () => {
    if (!staffMember) return;

    try {
      await mutations.deleteStaff();
      modals.closeDeleteDialog();
      setDeleteConfirmText('');
      router.push('/staff');
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  // Handle subject assignment (needs allSubjects for lookup)
  const handleAssignSubject = (subjectId: string) => {
    const subject = allSubjects.find(s => s.id === subjectId);
    if (!subject) return;
    editFlow.assignSubject(subject);
  };

  const handleStaffUpdated = () => {
    void invalidateStaffDetail(queryClient, id);
  };

  if (isLoading) {
    return <AdminLoadingSkeleton />;
  }

  if (!staffMember) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <UIButton
            variant="ghost"
            size="icon"
            onClick={() => router.push('/staff')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </UIButton>
          <h1 className="text-3xl font-bold tracking-tight">Staff Not Found</h1>
        </div>
      </div>
    );
  }

  const activityLayout = activeTab === 'activity';

  return (
    <div ref={setSidebarRoot} className="relative flex h-full min-h-0 flex-1 overflow-hidden">
    <div className={activityLayout ? 'flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4' : 'min-w-0 flex-1 overflow-y-auto p-4'}>
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center gap-2 border-b pb-3">
        <PrimaryEntityBreadcrumb />
        {narrow && <AdminPageActions priority="secondary"><UIButton variant="ghost" size="icon" aria-label="Right sidebar" aria-expanded={sidebarOpen} aria-controls="staff-properties-sidebar" onClick={() => setSidebarOpen(open => !open)}><PanelRight className="h-4 w-4" /></UIButton></AdminPageActions>}
        <IssuePill entityType="staff" entityId={id} enabled />
        <NoteAlertPills entityType="staff" entityId={staffMember.id} />

        <ActionsMenu
          type="staff"
          entityId={staffMember.id}
          copyTagDisplayText={`${staffMember.first_name || ''} ${staffMember.last_name || ''}`.trim()}
          {...staffActions}
        />
      </div>

      {/* Sections */}
      <SegmentedTabPanel
        value={activeTab}
        onValueChange={setActiveTab}
        className={activityLayout ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-6'}
        selectorClassName={activityLayout ? 'px-0' : undefined}
        options={[
          { value: 'activity', label: 'Activity' },
          { value: 'pay-tier', label: 'Pay tier' },
          { value: 'website', label: 'Website' },
          { value: 'classes', label: 'Classes' },
          { value: 'sessions', label: 'Sessions' },
          { value: 'files', label: 'Files' },
        ]}
      >
        <SegmentedTabPanelContent when="website" activeTab={activeTab} className="overflow-y-auto">
          <StaffWebsiteProfile key={staffMember.id} staffId={staffMember.id} active={staffMember.status === 'ACTIVE'} />
        </SegmentedTabPanelContent>
        <SegmentedTabPanelContent when="pay-tier" activeTab={activeTab} className="space-y-6"><StaffPayTierTab staffId={id} staffFirstName={staffMember.first_name} staffLastName={staffMember.last_name} onOpenSession={entityModals.openSession} /></SegmentedTabPanelContent>
        <SegmentedTabPanelContent when="classes" activeTab={activeTab} className="space-y-6">
          <ClassesTab
            staff={staffMember}
            onStaffUpdated={handleStaffUpdated}
          />
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="sessions" activeTab={activeTab} className="space-y-6">
          {staffMember && (
            <StaffSessionsTab staff={staffMember} />
          )}
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="files" activeTab={activeTab} className="space-y-6">
          <StaffFiles staffId={id} />
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="activity" activeTab={activeTab} className="-mx-4 flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityCommunicationPanel
            entityType="staff"
            entityId={id}
            className="min-h-0 flex-1"
          />
        </SegmentedTabPanelContent>
      </SegmentedTabPanel>

      {/* Log Staff Absence Dialog */}
      {currentStaff && (
        <LogStaffAbsenceDialog
          isOpen={modals.isLogAbsenceDialogOpen}
          onClose={modals.closeLogAbsence}
          staffId={currentStaff.id}
          initialStaffId={id}
          allowPastSessions={true}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {staffMember && (
        <AlertDialog
          open={modals.isDeleteDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              modals.closeDeleteDialog();
              setDeleteConfirmText('');
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
              <RetainedDeletionMessage name={`${staffMember.first_name} ${staffMember.last_name}`} />
            </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <div className="space-y-2">
                <Label>
                  Type <strong>{staffFullName}</strong> to confirm deletion
                </Label>
                <Input
                  type="text"
                  placeholder={staffFullName}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={mutations.isDeleting || deleteConfirmText !== staffFullName}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
    {sidebarOpen && <aside id="staff-properties-sidebar" aria-label="Properties" className={narrow ? 'absolute bottom-0 right-0 top-16 z-20 w-[min(100%,24rem)] overflow-y-auto border-l bg-background shadow-xl' : 'h-full w-96 shrink-0 overflow-y-auto border-l'}>
      <div className="border-b p-4 text-sm">
        <div className="font-medium">Properties</div>
        <div className="mt-3 flex items-center justify-between gap-3"><span className="text-muted-foreground">Account</span><span>{staffMember.user_id ? 'Has account' : 'No account'}</span></div>
      </div>
      <div className="p-4">
        <StaffDetailsTab
          staffMember={staffMember}
          isEditing={editFlow.isEditing}
          isLoading={mutations.isUpdatingDetails}
          onEdit={editFlow.startEdit}
          onCancelEdit={editFlow.cancelEdit}
          onSubmit={handleDetailsSubmit}
          staffSubjects={editFlow.isEditing ? editFlow.tempStaffSubjects : staffSubjects}
          onRemoveSubject={editFlow.removeSubject}
          onViewSubject={entityModals.openSubject}
          addSubjectButton={<SubjectSearchPopover selectedSubjects={editFlow.isEditing ? editFlow.tempStaffSubjects : staffSubjects} onSelectSubject={(subject) => handleAssignSubject(subject.id)} />}
        />
        {editFlow.isEditing && <div className="flex justify-end gap-2 border-t pt-4"><UIButton variant="outline" onClick={editFlow.cancelEdit} disabled={mutations.isUpdatingDetails}>Cancel</UIButton><UIButton disabled={mutations.isUpdatingDetails} onClick={() => { const form = document.getElementById('staff-edit-form') as HTMLFormElement | null; const submitButton = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null; if (submitButton) submitButton.click(); else form?.requestSubmit(); }}>{mutations.isUpdatingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</UIButton></div>}
      </div>
    </aside>}
    </div>
  );
}
