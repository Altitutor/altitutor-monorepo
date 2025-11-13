import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { useQueryClient } from '@tanstack/react-query';
import { classesApi } from "../../api";
import { useClassDetails, classesKeys } from '../../hooks/useClassesQuery';
import { useSubjects } from '@/features/subjects';
import { useStudents } from '@/features/students/hooks/useStudentsQuery';
import { useStaff } from '@/features/staff/hooks/useStaffQuery';
import { useUpdateClass } from '../../hooks/useClassesQuery';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { formatClassName } from '@/shared/utils';
import type { Tables, TablesUpdate } from '@altitutor/shared';
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
  const upcomingSessions = classDetails?.upcomingSessions || [];
  
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();
  const queryClient = useQueryClient();

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
      
      // Reset edit mode
      setIsEditing(false);
      
      // Notify parent of update
      onClassUpdated();
      // React Query will automatically refetch via invalidation
      
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

  // Early return if no class data loaded
  if (!classData) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Loading class...</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto max-w-md">
        <SheetHeader>
          <SheetTitle>
            Class Details
          </SheetTitle>
          <SheetDescription className="text-lg font-medium">
            {formatClassName(classData, subject)}
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6">
          <Tabs 
            defaultValue="details" 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="students" className="flex-1">Students</TabsTrigger>
              <TabsTrigger value="staff" className="flex-1">Staff</TabsTrigger>
            </TabsList>
            
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
              />
            </TabsContent>
            
            <TabsContent value="students" className="mt-4">
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
            
            <TabsContent value="staff" className="mt-4">
              <ClassStaffTab
                classData={classData}
                classStaff={classStaff}
                allStaff={allStaffData}
                loadingStaff={false}
                onAssignStaff={handleAssignStaff}
                onRemoveStaff={handleRemoveStaff}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
} 