'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, Button } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { Loader2, X } from "lucide-react";
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { ViewStudentModal } from './ViewStudentModal';
import { ParentDetailsTab, ParentDetailsFormData } from './tabs/ParentDetailsTab';
import { useStudents } from '../hooks/useStudentsQuery';
import { StudentSearchPopover } from './StudentSearchPopover';
import { useQueryClient } from '@tanstack/react-query';
import { ParentActivityTab } from '@/features/activity/components/tabs/ParentActivityTab';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useRouter } from 'next/navigation';
import { useParentDetails, parentsKeys } from '@/features/parents/hooks/useParentsQuery';
import {
  useParentEditFlow,
  useParentMutations,
  useParentModals,
  useParentConversation,
} from '@/features/parents/hooks';

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
            <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
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
                          {parent.first_name} {parent.last_name}
                        </SheetDescription>
                      </div>
                    </div>
                    {parentId && (
                      <ActionsMenu
                        type="parent"
                        onOpenInPage={() => {
                          router.push(`/parents/${parentId}`);
                          onClose();
                        }}
                      />
                    )}
                  </div>
                </SheetHeader>
                <div className="px-6 pb-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="messages">Messages</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 min-h-0 relative">
                <TabsContent value="details" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
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
                </TabsContent>

                <TabsContent value="messages" className="absolute inset-0 overflow-hidden m-0 p-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="h-full px-6 pb-6 pt-0">
                    <MessagesTabContent 
                      conversationId={conversationId}
                      title={`${parent.first_name} ${parent.last_name}`}
                      onClose={onClose}
                      relatedId={parentId || undefined}
                      relatedType="parent"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="p-6">
                    {parentId && (
                      <ParentActivityTab parentId={parentId} isOpen={isOpen} />
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
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
    </>
  );
}

