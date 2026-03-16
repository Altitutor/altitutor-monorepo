import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Input } from "@altitutor/ui";
import { Label } from "@altitutor/ui";
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
import { useRouter } from "next/navigation";
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { useClassActions } from '../../hooks/useClassActions';
import { useQueryClient } from '@tanstack/react-query';
import { classesApi } from "../../api";
import { useClassDetails, classesKeys, useDeleteClass } from '../../hooks/useClassesQuery';
import { useSubjects } from '@/features/subjects';
import { useStudents } from '@/features/students/hooks/useStudentsQuery';
import { useStaff } from '@/features/staff/hooks/useStaffQuery';
import { useUpdateClass } from '../../hooks/useClassesQuery';
import type { TablesUpdate } from '@altitutor/shared';
import { ClassInfoTab, ClassInfoFormData } from './tabs/ClassInfoTab';
import { ClassStudentsTab } from './tabs/ClassStudentsTab';
import { ClassStaffTab } from './tabs/ClassStaffTab';
import { ClassSessionsTab } from './tabs/ClassSessionsTab';
import { ClassActivityTab } from '@/features/activity/components/tabs/ClassActivityTab';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { useNestedModalEvents } from '@/shared/hooks/useNestedModalEvents';
import { IssuePill } from '@/features/issues';

interface ViewClassModalProps {
  isOpen: boolean;
  classId: string | null;
  onClose: () => void;
  onClassUpdated: () => void;
}

export function ViewClassModal({ 
  isOpen, 
  classId, 
  onClose, 
  onClassUpdated 
}: ViewClassModalProps) {
  const router = useRouter();
  // Use React Query hooks for data fetching
  const { data: classDetails, isLoading } = useClassDetails(classId || '', isOpen && !!classId);
  const { data: allSubjects = [] } = useSubjects();
  const { data: allStudentsData = [] } = useStudents();
  const { data: allStaffData = [] } = useStaff();
  const updateClassMutation = useUpdateClass();
  
  // Extract data from classDetails
  const classData = classDetails?.class || null;
  const subject = classDetails?.subject || null;
  const classStudents = classDetails?.students || [];
  const classStaff = classDetails?.staff || [];
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Nested modal state for sessions table interactions
  const {
    nestedSessionId,
    nestedStaffId,
    nestedStudentId,
    setNestedSessionId,
    setNestedStaffId,
    setNestedStudentId,
  } = useNestedModalEvents({ isOpen });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Centralized action handlers
  const classActions = useClassActions({
    classId: classId || '',
    onOpenInPage: () => {
      router.push(`/classes/${classId}`);
      onClose();
    },
    onDelete: () => {
      setDeleteConfirmText('');
      setIsDeleteDialogOpen(true);
    },
  });
  const deleteClassMutation = useDeleteClass();

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setActiveTab('details');
    }
  }, [isOpen]);

  // Update class handler
  const handleClassUpdate = async (data: ClassInfoFormData) => {
    if (!classData) return;
    
    try {
      const updateData: TablesUpdate<'classes'> = {
        level: data.level || null,
        day_of_week: data.dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        status: data.status,
        subject_id: data.subjectId || null,
        room: data.room || null,
        session_start_date: data.sessionStartDate || null,
        session_end_date: data.sessionEndDate || null,
      };
      await updateClassMutation.mutateAsync({ id: classData.id, data: updateData });
      
      // Invalidate class details to refetch full data including subject relationship
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(classData.id) });
      
      // Reset edit mode
      setIsEditing(false);
      
      // Notify parent of update
      onClassUpdated();
      
      toast({
        title: 'Class updated',
        description: 'Class has been updated successfully.',
      });
    } catch (err) {
      console.error('Failed to update class:', err);
      toast({
        title: 'Update failed',
        description: 'There was an error updating the class. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle staff assignment
  const handleAssignStaff = async (staffId: string) => {
    if (!classData) return;
    
    try {
      await classesApi.assignStaff(classData.id, staffId);
      // Invalidate class details and classes list
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(classData.id) });
      queryClient.invalidateQueries({ queryKey: classesKeys.minimal() });
      onClassUpdated();
      toast({
        title: 'Success',
        description: 'Staff assigned successfully.',
      });
    } catch (err) {
      console.error('Failed to assign staff:', err);
      toast({
        title: 'Assignment failed',
        description: 'There was an error assigning the staff. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle staff removal
  const handleRemoveStaff = async (staffId: string) => {
    if (!classData) return;
    
    try {
      await classesApi.unassignStaff(classData.id, staffId);
      // Invalidate class details and classes list
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(classData.id) });
      queryClient.invalidateQueries({ queryKey: classesKeys.minimal() });
      onClassUpdated();
      toast({
        title: 'Success',
        description: 'Staff removed successfully.',
      });
    } catch (err) {
      console.error('Failed to remove staff:', err);
      toast({
        title: 'Removal failed',
        description: 'There was an error removing the staff. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle class deletion
  const handleDeleteClass = async () => {
    if (!classData) return;
    
    try {
      setIsDeleting(true);
      await deleteClassMutation.mutateAsync(classData.id);
      onClose();
      onClassUpdated();
      toast({
        title: 'Class deleted',
        description: 'Class has been deleted successfully.',
      });
    } catch (err) {
      console.error('Failed to delete class:', err);
      toast({
        title: 'Delete failed',
        description: 'There was an error deleting the class. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Early return if no class data loaded
  if (!classData) {
    return (
      <>
        <Sheet open={isOpen} onOpenChange={onClose}>
          <SheetContent className="w-full md:w-[600px] md:max-w-none">
            <SheetHeader>
              <SheetTitle>Loading class...</SheetTitle>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        {/* Nested Session Modal */}
        <SessionModal
          isOpen={!!nestedSessionId}
          sessionId={nestedSessionId}
          onClose={() => setNestedSessionId(null)}
        />

        {/* Nested Staff Modal */}
        {nestedStaffId && (
          <ViewStaffModal
            isOpen={!!nestedStaffId}
            staffId={nestedStaffId}
            onClose={() => setNestedStaffId(null)}
            onStaffUpdated={onClassUpdated}
          />
        )}

        {/* Nested Student Modal */}
        {nestedStudentId && (
          <ViewStudentModal
            isOpen={!!nestedStudentId}
            studentId={nestedStudentId}
            onClose={() => setNestedStudentId(null)}
            onStudentUpdated={onClassUpdated}
          />
        )}
      </>
    );
  }

  return (
    <>
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent hideCloseButton className="h-full max-h-[100vh] flex flex-col p-0 w-full md:w-[600px] lg:w-[800px] md:max-w-none">
        <Tabs 
          defaultValue="details" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="flex flex-col h-full min-h-0"
        >
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
                      {isEditing ? 'Edit Class' : 'Class Details'}
                    </SheetTitle>
                    <SheetDescription className="text-lg font-medium">
                      <div className="flex items-center gap-2 flex-wrap">
                        {classData.long_name?.trim() ?? ''}
                        <IssuePill
                          entityType="class"
                          entityId={classId}
                          enabled={isOpen && !!classId}
                        />
                      </div>
                    </SheetDescription>
                  </div>
                </div>
                {classId && (
                  <ActionsMenu
                    type="class"
                    entityId={classId}
                    copyTagDisplayText={classData.short_name?.trim() ?? ''}
                    {...classActions}
                  />
                )}
              </div>
            </SheetHeader>
            <div className="px-6 pb-4">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                <TabsTrigger value="students" className="flex-1">Students</TabsTrigger>
                <TabsTrigger value="staff" className="flex-1">Staff</TabsTrigger>
                <TabsTrigger value="sessions" className="flex-1">Sessions</TabsTrigger>
                <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 min-h-0 relative">
            <TabsContent value="details" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
              <div className="p-6">
                <ClassInfoTab
                  classData={classData}
                  subject={subject}
                  subjects={allSubjects}
                  isEditing={isEditing}
                  isLoading={isLoading}
                  onEdit={() => setIsEditing(true)}
                  onCancelEdit={() => setIsEditing(false)}
                  onSubmit={handleClassUpdate}
                />
              </div>
            </TabsContent>
        
            <TabsContent value="students" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
              <div className="p-6">
                <ClassStudentsTab
                  classData={classData}
                  classSubject={subject || undefined}
                  classStaff={classStaff}
                  classStudents={classStudents}
                  allStudents={allStudentsData}
                  loadingStudents={false}
                  onStudentsUpdated={() => {}}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="staff" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
              <div className="p-6">
                <ClassStaffTab
                  classData={classData}
                  classSubject={subject || undefined}
                  classStaff={classStaff}
                  allStaff={allStaffData}
                  loadingStaff={false}
                  onAssignStaff={handleAssignStaff}
                  onRemoveStaff={handleRemoveStaff}
                />
              </div>
            </TabsContent>
        
            <TabsContent value="sessions" className="absolute inset-0 overflow-hidden m-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
              <div className="h-full p-6">
                <ClassSessionsTab
                  classData={classData}
                  classStudents={classStudents}
                  classStaff={classStaff}
                />
              </div>
            </TabsContent>

            <TabsContent value="activity" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
              <div className="p-6">
                {classId && (
                  <ClassActivityTab classId={classId} isOpen={isOpen} />
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
        
        {/* Sticky Footer with Buttons */}
        {classData && isEditing && activeTab === 'details' && (
          <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
            <div className="flex w-full justify-end">
              <div className="flex space-x-2">
                <Button variant="outline" type="button" onClick={() => setIsEditing(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button 
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    const form = document.getElementById('class-edit-form') as HTMLFormElement;
                    if (form) {
                      form.requestSubmit();
                    }
                  }}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>

    {/* Nested Session Modal */}
    <SessionModal
      isOpen={!!nestedSessionId}
      sessionId={nestedSessionId}
      onClose={() => setNestedSessionId(null)}
    />

    {/* Nested Staff Modal */}
    {nestedStaffId && (
      <ViewStaffModal
        isOpen={!!nestedStaffId}
        staffId={nestedStaffId}
        onClose={() => setNestedStaffId(null)}
        onStaffUpdated={onClassUpdated}
      />
    )}

    {/* Nested Student Modal */}
    {nestedStudentId && (
      <ViewStudentModal
        isOpen={!!nestedStudentId}
        studentId={nestedStudentId}
        onClose={() => setNestedStudentId(null)}
        onStudentUpdated={onClassUpdated}
      />
    )}

    {/* Delete confirmation dialog */}
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
      if (!open) {
        setDeleteConfirmText('');
      }
      setIsDeleteDialogOpen(open);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the class
            {classData?.level ? ` "${classData.level}"` : ''} and all associated data from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <div className="space-y-2">
            <Label>
              {classData?.level ? (
                <>Type <strong>{classData.level}</strong> to confirm deletion</>
              ) : (
                <>Type <strong>DELETE</strong> to confirm deletion</>
              )}
            </Label>
            <Input
              type="text"
              placeholder={classData?.level || 'DELETE'}
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
              handleDeleteClass();
              setIsDeleteDialogOpen(false);
              setDeleteConfirmText('');
            }}
            disabled={isDeleting || (classData?.level ? deleteConfirmText !== classData.level : deleteConfirmText !== 'DELETE')}
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
