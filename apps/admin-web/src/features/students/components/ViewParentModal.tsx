'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, Button } from "@altitutor/ui";
import { SegmentedControl, SegmentedTabPanelContent } from "@altitutor/ui";
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
import { Loader2, X } from "lucide-react";
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { ViewStudentModal } from './ViewStudentModal';
import { ParentDetailsTab, ParentDetailsFormData } from './tabs/ParentDetailsTab';
import { useStudents } from '../hooks/useStudentsQuery';
import { StudentSearchPopover } from './StudentSearchPopover';
import { useQueryClient } from '@tanstack/react-query';
import { ParentActivityTab } from '@/features/activity/components/tabs/ParentActivityTab';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { getErrorMessage } from '@/shared/utils';
import { useRouter } from 'next/navigation';
import { useParentDetails, parentsKeys, useDeleteParent } from '@/features/parents/hooks/useParentsQuery';
import {
  useParentEditFlow,
  useParentMutations,
  useParentModals,
  useParentConversation,
} from '@/features/parents/hooks';
import { IssuePill } from '@/features/issues';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';

interface ViewParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string | null;
  onParentUpdated?: () => void;
  defaultTab?: string; // Keep for backwards compatibility but won't use it
}

export function ViewParentModal({
  isOpen,
  onClose,
  parentId,
  onParentUpdated,
}: ViewParentModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Data fetching
  const { data: parentData, isLoading: loadingParent } = useParentDetails(parentId, isOpen && !!parentId);
  const { data: allStudents = [] } = useStudents();
  
  const parent = parentData?.parent || null;
  const students = parentData?.students || [];

  // Business logic hooks
  const editFlow = useParentEditFlow({
    initialStudents: students,
  });

  const mutations = useParentMutations({
    parentId: parentId || '',
    onSuccess: () => {
      if (parentId) {
        queryClient.invalidateQueries({ queryKey: parentsKeys.detail(parentId) });
      }
      editFlow.reset();
      onParentUpdated?.();
    },
  });

  const modals = useParentModals();

  const conversationId = useParentConversation({
    parentId: parentId,
    enabled: isOpen && !!parentId,
  });

  // UI state
  const [activeTab, setActiveTab] = useState('details');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteParentMutation = useDeleteParent();
  const { toast } = useToast();
  const { openCheckInModal } = useQuickActions();

  // Reset modals when modal closes
  useEffect(() => {
    if (!isOpen) {
      editFlow.cancelEdit();
      modals.reset();
      setActiveTab('details');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
    if (!parent || !parentId) return;
    try {
      setIsDeleting(true);
      await deleteParentMutation.mutateAsync(parentId);
      onClose();
      onParentUpdated?.();
      toast({
        title: 'Parent deleted',
        description: 'Parent has been deleted successfully.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Delete failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!parent && loadingParent) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent hideCloseButton className="w-full md:w-[600px] lg:w-[800px] md:max-w-none">
          <div className="flex justify-center items-center h-32">
            Loading...
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!parent) return null;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent hideCloseButton className="w-full md:w-[600px] lg:w-[800px] md:max-w-none h-full flex flex-col p-0">
          {!parent ? (
            <div className="flex justify-center items-center h-full p-6">
              <div className="text-muted-foreground">
                {loadingParent ? 'Loading...' : ''}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full min-h-0">
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
                        <SheetTitle>
                          {editFlow.isEditing ? 'Edit Parent' : 'Parent Details'}
                        </SheetTitle>
                        <SheetDescription className="text-lg font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            {parent.first_name} {parent.last_name}
                            <IssuePill
                              entityType="parent"
                              entityId={parentId}
                              enabled={isOpen && !!parentId}
                            />
                          </div>
                        </SheetDescription>
                      </div>
                    </div>
                    {parentId && (
                      <ActionsMenu
                        type="parent"
                        entityId={parentId}
                        copyTagDisplayText={`${parent.first_name || ''} ${parent.last_name || ''}`.trim()}
                        onOpenInPage={() => {
                          router.push(`/parents/${parentId}`);
                          onClose();
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
                    )}
                  </div>
                </SheetHeader>
                <div className="px-6 pb-4">
                  <SegmentedControl
                    fullWidth
                    value={activeTab}
                    onValueChange={setActiveTab}
                    options={[
                      { value: 'details', label: 'Details' },
                      { value: 'messages', label: 'Messages' },
                      { value: 'activity', label: 'Activity' },
                    ]}
                  />
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 min-h-0 relative">
                <SegmentedTabPanelContent when="details" activeTab={activeTab} className="absolute inset-0 overflow-y-auto">
                  <div className="px-6 pb-6 pt-0">
                    <ParentDetailsTab
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
                      addStudentButton={
                        editFlow.isEditing ? (
                          <StudentSearchPopover
                            allStudents={allStudents}
                            selectedStudents={editFlow.tempParentStudents}
                            onSelectStudent={editFlow.assignStudent}
                          />
                        ) : undefined
                      }
                    />
                  </div>
                </SegmentedTabPanelContent>

                <SegmentedTabPanelContent when="messages" activeTab={activeTab} className="absolute inset-0 overflow-hidden flex flex-col">
                  <div className="h-full px-6 pb-6 pt-0">
                    <MessagesTabContent 
                      conversationId={conversationId}
                      title={`${parent.first_name} ${parent.last_name}`}
                      onClose={onClose}
                      relatedId={parentId || undefined}
                      relatedType="parent"
                    />
                  </div>
                </SegmentedTabPanelContent>

                <SegmentedTabPanelContent when="activity" activeTab={activeTab} className="absolute inset-0 overflow-y-auto">
                  <div className="p-6">
                    {parentId && (
                      <ParentActivityTab parentId={parentId} isOpen={isOpen} />
                    )}
                  </div>
                </SegmentedTabPanelContent>
              </div>
            </div>
          )}

          {/* Sticky Footer with Buttons */}
          {parent && editFlow.isEditing && activeTab === 'details' && (
            <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
              <div className="flex w-full justify-end">
                <div className="flex space-x-2">
                  <Button variant="outline" type="button" onClick={editFlow.cancelEdit} disabled={mutations.isUpdatingDetails}>
                    Cancel
                  </Button>
                  <Button 
                    type="button"
                    disabled={mutations.isUpdatingDetails}
                    onClick={() => {
                      const form = document.getElementById('parent-edit-form') as HTMLFormElement;
                      if (form) {
                        form.requestSubmit();
                      }
                    }}
                  >
                    {mutations.isUpdatingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Student Modal */}
      {modals.selectedStudentId && (
        <ViewStudentModal
          isOpen={modals.studentModalOpen}
          onClose={modals.closeStudentModal}
          studentId={modals.selectedStudentId}
          onStudentUpdated={() => {
            if (parentId) {
              queryClient.invalidateQueries({ queryKey: parentsKeys.detail(parentId) });
            }
            if (onParentUpdated) onParentUpdated();
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
              This action cannot be undone. This will permanently delete the parent
              {parent ? ` ${parent.first_name} ${parent.last_name}` : ''} and all associated data from the database.
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
    </>
  );
}
