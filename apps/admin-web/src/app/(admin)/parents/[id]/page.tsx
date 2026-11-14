'use client';
import { EntityPropertiesLayout, EntityPropertiesToggle } from '@/shared/components/EntityPropertiesLayout';
import { RetainedDeletionMessage } from "@/shared/components/RetainedDeletionMessage";

import { PrimaryEntityBreadcrumb } from '@/shared/components/PrimaryEntityBreadcrumb';
import { useAdminPageViewParam } from '@/shared/hooks/useAdminPageViewParam';

import { NoteAlertPills } from '@/shared/components/NoteAlertPills';
import { useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedTabPanel, SegmentedTabPanelContent } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
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
import { Loader2, ArrowLeft } from "lucide-react";
import { useQueryClient } from '@tanstack/react-query';
import { FormResponseCommands } from '@/features/forms/components/FormResponseCommands';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ParentDetailsTab, ParentDetailsFormData } from '@/features/students/components/tabs/ParentDetailsTab';
import { ParentSessionsTab } from '@/features/students/components/ParentSessionsTab';
import { useStudents } from '@/features/students/hooks/useStudentsQuery';
import { StudentSearchPopover } from '@/features/students/components/StudentSearchPopover';
import { EntityCommunicationPanel } from '@/features/activity/components/EntityCommunicationPanel';
import { useParentDetails, parentsKeys, useDeleteParent } from '@/features/parents/hooks/useParentsQuery';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import {
  useParentEditFlow,
  useParentMutations,
  useParentModals,
} from '@/features/parents/hooks';
import { AdminLoadingSkeleton } from '@/shared/components';

export default function ParentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { id } = params;
  const router = useRouter();
  const sidebarForm = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { openCheckInModal } = useQuickActions();

  // Data fetching
  const { data: parentData, isLoading } = useParentDetails(id, !!id);
  const { data: allStudents = [] } = useStudents();

  const parent = parentData?.parent || null;
  const students = parentData?.students || [];

  // Business logic hooks
  const editFlow = useParentEditFlow({
    initialStudents: students,
  });

  const mutations = useParentMutations({
    parentId: id,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentsKeys.detail(id) });
      editFlow.reset();
    },
  });

  const modals = useParentModals();

  // UI state
  const [activeTab, setActiveTab] = useAdminPageViewParam(['activity', 'sessions'] as const, 'activity', 'tab');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteParentMutation = useDeleteParent();
  const { toast } = useToast();

  // Handle details submit
  const handleDetailsSubmit = async (data: ParentDetailsFormData) => {
    if (!parent) return;

    await mutations.updateDetails(
      data,
      {
        toAdd: editFlow.studentsToAdd,
        toRemove: editFlow.studentsToRemove,
      }
    );
  };

  const handleDeleteParent = async () => {
    if (!parent) return;
    try {
      setIsDeleting(true);
      await deleteParentMutation.mutateAsync(id);
      router.push('/parents');
      toast({
        title: 'Parent deleted',
        description: 'Parent has been deleted successfully.',
      });
    } catch {
      toast({
        title: 'Delete failed',
        description: 'There was an error deleting the parent. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <AdminLoadingSkeleton />;
  }

  if (!parent) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/parents')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Parent Not Found</h1>
        </div>
      </div>
    );
  }

  const activityLayout = activeTab === 'activity';

  return (
    <EntityPropertiesLayout id="parent-properties-sidebar" sidebar={<>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" ref={sidebarForm}>
        <ParentDetailsTab
          key={`${id}:${editFlow.isEditing}`}
          parent={parent}
          studentIds={students.map(s => s.id)}
          students={students}
          onViewStudent={modals.openStudentModal}
          isEditing={editFlow.isEditing}
          isLoading={mutations.isUpdatingDetails}
          onEdit={editFlow.startEdit}
          onCancelEdit={editFlow.cancelEdit}
          onSubmit={handleDetailsSubmit}
          parentStudents={editFlow.isEditing ? editFlow.tempParentStudents : students}
          onRemoveStudent={editFlow.removeStudent}
          addStudentButton={editFlow.isEditing ? <StudentSearchPopover allStudents={allStudents} selectedStudents={editFlow.tempParentStudents} onSelectStudent={editFlow.assignStudent} /> : undefined}
        />
        {!editFlow.isEditing && (
          <section className="space-y-2 border-t pt-4" aria-label="Account">
            <h3 className="text-base font-medium">Account</h3>
            <p className="text-sm text-muted-foreground">{parent.user_id ? 'Has account' : 'No account'}</p>
          </section>
        )}
        </div>
        {editFlow.isEditing && <div className="flex shrink-0 justify-end gap-2 border-t bg-background p-4"><Button variant="outline" onClick={editFlow.cancelEdit} disabled={mutations.isUpdatingDetails}>Cancel</Button><Button disabled={mutations.isUpdatingDetails} onClick={() => sidebarForm.current?.querySelector('form')?.requestSubmit()}>{mutations.isUpdatingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button></div>}
      </div>
</>}>
    <div className={activityLayout ? 'flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4' : 'min-w-0 flex-1 overflow-y-auto p-4'}>
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center gap-2 border-b pb-3">
        <PrimaryEntityBreadcrumb label={`${parent.first_name ?? ""} ${parent.last_name ?? ""}`.trim()} />
        <EntityPropertiesToggle />
        <NoteAlertPills entityType="parent" entityId={parent.id} />

        <FormResponseCommands record={{ type: "parent", id: parent.id, title: `${parent.first_name ?? ""} ${parent.last_name ?? ""}`.trim() }} />
        <ActionsMenu
          type="parent"
          entityId={parent.id}
          copyTagDisplayText={`${parent.first_name || ''} ${parent.last_name || ''}`.trim()}
          onOpenInPage={() => {
            router.push(`/parents/${id}`);
          }}
          onBookCheckIn={() =>
            openCheckInModal({
              parents: [
                {
                  id: parent.id,
                  first_name: parent.first_name,
                  last_name: parent.last_name,
                },
              ],
            })
          }
          onDelete={() => {
            setDeleteConfirmText('');
            setIsDeleteDialogOpen(true);
          }}
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
          { value: 'sessions', label: 'Sessions' },
        ]}
      >
        <SegmentedTabPanelContent when="sessions" activeTab={activeTab} className="space-y-6">
          <ParentSessionsTab parent={parent} />
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="activity" activeTab={activeTab} className="-mx-4 flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntityCommunicationPanel
            recordActivity
            allowForm
            className="min-h-0 flex-1"
            entityType="parent"
            entityId={id}
          />
        </SegmentedTabPanelContent>
      </SegmentedTabPanel>

      {/* Student Modal */}
      {modals.selectedStudentId && (
        <ViewStudentModal
          isOpen={modals.studentModalOpen}
          onClose={modals.closeStudentModal}
          studentId={modals.selectedStudentId}
          onStudentUpdated={() => {
            queryClient.invalidateQueries({ queryKey: parentsKeys.detail(id) });
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        if (!open) setDeleteConfirmText('');
        setIsDeleteDialogOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              <RetainedDeletionMessage kind="Parent" name={parent ? `${parent.first_name} ${parent.last_name}` : undefined} />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label>
                Type <strong>DELETE</strong> to confirm deletion
              </Label>
              <Input
                type="text"
                placeholder="Type DELETE to confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleDeleteParent();
                setIsDeleteDialogOpen(false);
                setDeleteConfirmText('');
              }}
              disabled={isDeleting || deleteConfirmText !== 'DELETE'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
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
    </div>

    </EntityPropertiesLayout>
  );
}
