'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
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
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ParentDetailsTab, ParentDetailsFormData } from '@/features/students/components/tabs/ParentDetailsTab';
import { useStudents } from '@/features/students/hooks/useStudentsQuery';
import { StudentSearchPopover } from '@/features/students/components/StudentSearchPopover';
import { ParentActivityTab } from '@/features/activity/components/tabs/ParentActivityTab';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { useParentDetails, parentsKeys, useDeleteParent } from '@/features/parents/hooks/useParentsQuery';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import {
  useParentEditFlow,
  useParentMutations,
  useParentModals,
  useParentConversation,
} from '@/features/parents/hooks';

export default function ParentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
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

  const conversationId = useParentConversation({
    parentId: id,
    enabled: !!id,
  });

  // UI state
  const [activeTab, setActiveTab] = useState('details');
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
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!parent) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/parents')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {editFlow.isEditing ? 'Edit Parent' : 'Parent Details'}
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            {parent.first_name} {parent.last_name}
          </p>
        </div>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full">
          <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
          <TabsTrigger value="messages" className="flex-1">Messages</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
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
          {editFlow.isEditing && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={editFlow.cancelEdit} disabled={mutations.isUpdatingDetails}>
                Cancel
              </Button>
              <Button 
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
          )}
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <div className="h-[600px]">
            <MessagesTabContent 
              conversationId={conversationId}
              title={`${parent.first_name} ${parent.last_name}`}
              onClose={() => router.push('/parents')}
              relatedId={id}
              relatedType="parent"
            />
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <ParentActivityTab parentId={id} isOpen={true} />
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
