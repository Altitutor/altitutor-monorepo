import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Loader2 } from "lucide-react";
import { useQueryClient } from '@tanstack/react-query';
import { classesApi } from "../../api";
import { useClassDetails, classesKeys, useDeleteClass } from '../../hooks/useClassesQuery';
import { useSubjects } from '@/features/subjects';
import { useStudents } from '@/features/students/hooks/useStudentsQuery';
import { useStaff } from '@/features/staff/hooks/useStaffQuery';
import { useUpdateClass } from '../../hooks/useClassesQuery';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { formatClassName } from '@/shared/utils';
import type { TablesUpdate } from '@altitutor/shared';
import { ClassInfoTab, ClassInfoFormData } from './tabs/ClassInfoTab';
import { ClassStudentsTab } from './tabs/ClassStudentsTab';
import { ClassStaffTab } from './tabs/ClassStaffTab';

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
  const _upcomingSessions = classDetails?.upcomingSessions || [];
  
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { toast } = useToast();
  const { data: _currentStaff } = useCurrentStaff();
  const queryClient = useQueryClient();
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
        level: data.level,
        day_of_week: data.dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        status: data.status,
        subject_id: data.subjectId || null,
        room: data.room || null,
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
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[600px] max-w-[90vw]">
          <SheetHeader>
            <SheetTitle>Loading class...</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="h-full max-h-[100vh] flex flex-col p-0 w-[600px] max-w-[90vw]">
        <Tabs 
          defaultValue="details" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="flex flex-col h-full min-h-0"
        >
          {/* Sticky Header */}
          <div className="flex-shrink-0 border-b bg-background sticky top-0 z-10">
            <SheetHeader className="px-6 pt-6 pb-4">
              <SheetTitle>
                {isEditing ? 'Edit Class' : 'Class Details'}
              </SheetTitle>
              <SheetDescription className="text-lg font-medium">
                {formatClassName(classData, subject)}
              </SheetDescription>
            </SheetHeader>
            <div className="px-6 pb-4">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                <TabsTrigger value="students" className="flex-1">Students</TabsTrigger>
                <TabsTrigger value="staff" className="flex-1">Staff</TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6">
              <div className="flex-1 min-h-0 overflow-hidden">
                <TabsContent value="details" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <ClassInfoTab
                    classData={classData}
                    subject={subject}
                    subjects={allSubjects}
                    isEditing={isEditing}
                    isLoading={isLoading}
                    onEdit={() => setIsEditing(true)}
                    onCancelEdit={() => setIsEditing(false)}
                    onSubmit={handleClassUpdate}
                    onDelete={isEditing ? handleDeleteClass : undefined}
                    isDeleting={isDeleting}
                  />
                </TabsContent>
            
            <TabsContent value="students" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <ClassStudentsTab
                classData={classData}
                classSubject={subject || undefined}
                classStaff={classStaff}
                classStudents={classStudents}
                allStudents={allStudentsData}
                loadingStudents={false}
                onStudentsUpdated={() => {}}
              />
            </TabsContent>
            
                <TabsContent value="staff" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <ClassStaffTab
                    classData={classData}
                    classStaff={classStaff}
                    allStaff={allStaffData}
                    loadingStaff={false}
                    onAssignStaff={handleAssignStaff}
                    onRemoveStaff={handleRemoveStaff}
                  />
                </TabsContent>
              </div>
            </div>
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
  );
} 