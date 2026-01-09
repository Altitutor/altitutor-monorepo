'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Loader2, ArrowLeft } from "lucide-react";
import { useQueryClient } from '@tanstack/react-query';
import { classesApi } from "@/features/classes/api";
import { useClassDetails, classesKeys, useDeleteClass } from '@/features/classes/hooks/useClassesQuery';
import { useSubjects } from '@/features/subjects';
import { useStudents } from '@/features/students/hooks/useStudentsQuery';
import { useStaff } from '@/features/staff/hooks/useStaffQuery';
import { useUpdateClass } from '@/features/classes/hooks/useClassesQuery';
import { formatClassName } from '@/shared/utils';
import type { TablesUpdate } from '@altitutor/shared';
import { ClassInfoTab, ClassInfoFormData } from '@/features/classes/components/modal/tabs/ClassInfoTab';
import { ClassStudentsTab } from '@/features/classes/components/modal/tabs/ClassStudentsTab';
import { ClassStaffTab } from '@/features/classes/components/modal/tabs/ClassStaffTab';
import { ClassSessionsTab } from '@/features/classes/components/modal/tabs/ClassSessionsTab';
import { ClassActivityTab } from '@/features/activity/components/tabs/ClassActivityTab';

export default function ClassDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: classDetails, isLoading } = useClassDetails(id, !!id);
  const { data: allSubjects = [] } = useSubjects();
  const { data: allStudentsData = [] } = useStudents();
  const { data: allStaffData = [] } = useStaff();
  const updateClassMutation = useUpdateClass();
  const deleteClassMutation = useDeleteClass();
  
  const classData = classDetails?.class || null;
  const subject = classDetails?.subject || null;
  const classStudents = classDetails?.students || [];
  const classStaff = classDetails?.staff || [];
  
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [isDeleting, setIsDeleting] = useState(false);

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
        session_start_date: data.sessionStartDate || null,
        session_end_date: data.sessionEndDate || null,
      };
      await updateClassMutation.mutateAsync({ id: classData.id, data: updateData });
      
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(classData.id) });
      
      setIsEditing(false);
      
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

  const handleAssignStaff = async (staffId: string) => {
    if (!classData) return;
    
    try {
      await classesApi.assignStaff(classData.id, staffId);
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(classData.id) });
      queryClient.invalidateQueries({ queryKey: classesKeys.minimal() });
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

  const handleRemoveStaff = async (staffId: string) => {
    if (!classData) return;
    
    try {
      await classesApi.unassignStaff(classData.id, staffId);
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(classData.id) });
      queryClient.invalidateQueries({ queryKey: classesKeys.minimal() });
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

  const handleDeleteClass = async () => {
    if (!classData) return;
    
    try {
      setIsDeleting(true);
      await deleteClassMutation.mutateAsync(classData.id);
      router.push('/classes');
      
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

  const handleClassUpdated = () => {
    queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(id) });
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

  if (!classData) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/classes')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Class Not Found</h1>
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
          onClick={() => router.push('/classes')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? 'Edit Class' : 'Class Details'}
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            {formatClassName(classData, subject)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full">
          <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
          <TabsTrigger value="students" className="flex-1">Students</TabsTrigger>
          <TabsTrigger value="staff" className="flex-1">Staff</TabsTrigger>
          <TabsTrigger value="sessions" className="flex-1">Sessions</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <ClassInfoTab
            classData={classData}
            subject={subject || undefined}
            subjects={allSubjects}
            isEditing={isEditing}
            isLoading={isLoading}
            onEdit={() => setIsEditing(true)}
            onCancelEdit={() => setIsEditing(false)}
            onSubmit={handleClassUpdate}
            onDelete={isEditing ? handleDeleteClass : undefined}
            isDeleting={isDeleting}
          />
          {isEditing && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button 
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
          )}
        </TabsContent>

        <TabsContent value="students" className="space-y-6">
          <ClassStudentsTab
            classData={classData}
            classSubject={subject || undefined}
            classStaff={classStaff}
            classStudents={classStudents}
            allStudents={allStudentsData}
            loadingStudents={false}
            onStudentsUpdated={handleClassUpdated}
          />
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <ClassStaffTab
            classData={classData}
            classStaff={classStaff}
            allStaff={allStaffData}
            loadingStaff={false}
            onAssignStaff={handleAssignStaff}
            onRemoveStaff={handleRemoveStaff}
          />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          {classData && (
            <ClassSessionsTab
              classData={classData}
              classStudents={classStudents}
              classStaff={classStaff}
            />
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <ClassActivityTab classId={id} isOpen={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
