'use client';

import { useState, useEffect } from 'react';
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
import { formatClassName } from '@/shared/utils';
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

interface ClassViewContentProps {
  classId: string;
  isOpen: boolean;
  onClose: () => void;
  onClassUpdated: () => void;
  hideHeader?: boolean;
}

export function ClassViewContent({
  classId,
  isOpen,
  onClose,
  onClassUpdated,
  hideHeader = false
}: ClassViewContentProps) {
  const router = useRouter();
  const { data: classDetails, isLoading } = useClassDetails(classId, isOpen);
  const { data: allSubjects = [] } = useSubjects();
  const { data: allStudentsData = [] } = useStudents();
  const { data: allStaffData = [] } = useStaff();
  const updateClassMutation = useUpdateClass();
  
  const classData = classDetails?.class || null;
  const subject = classDetails?.subject || null;
  const classStudents = classDetails?.students || [];
  const classStaff = classDetails?.staff || [];
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
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

  const classActions = useClassActions({
    classId: classId,
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

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setActiveTab('details');
    }
  }, [isOpen]);

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
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(classData.id) });
      setIsEditing(false);
      onClassUpdated();
      toast({ title: 'Updated', description: 'Class updated.' });
    } catch (err) {
      toast({ title: 'Failed', description: 'Update error.', variant: 'destructive' });
    }
  };

  const handleAssignStaff = async (staffId: string) => {
    if (!classData) return;
    try {
      await classesApi.assignStaff(classData.id, staffId);
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(classData.id) });
      onClassUpdated();
      toast({ title: 'Success', description: 'Staff assigned.' });
    } catch (err) {
      toast({ title: 'Failed', description: 'Assign error.', variant: 'destructive' });
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!classData) return;
    try {
      await classesApi.unassignStaff(classData.id, staffId);
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(classData.id) });
      onClassUpdated();
      toast({ title: 'Success', description: 'Staff removed.' });
    } catch (err) {
      toast({ title: 'Failed', description: 'Remove error.', variant: 'destructive' });
    }
  };

  const handleDeleteClass = async () => {
    if (!classData) return;
    try {
      setIsDeleting(true);
      await deleteClassMutation.mutateAsync(classData.id);
      onClose();
      onClassUpdated();
      toast({ title: 'Deleted', description: 'Class deleted.' });
    } catch (err) {
      toast({ title: 'Failed', description: 'Delete error.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!classData) {
    return (
      <div className="flex justify-center items-center h-full p-6">
        <div className="text-muted-foreground">{isLoading ? 'Loading...' : ''}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
        {!hideHeader && (
          <div className="flex-shrink-0 border-b bg-background sticky top-0 z-10">
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={onClose} className="shrink-0">
                  <X className="h-4 w-4" />
                </Button>
                <h2 className="text-lg font-semibold">{formatClassName(classData, subject)}</h2>
              </div>
              <ActionsMenu type="class" {...classActions} />
            </div>
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
        )}

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
              <ClassSessionsTab classData={classData} classStudents={classStudents} classStaff={classStaff} />
            </div>
          </TabsContent>
          <TabsContent value="activity" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
            <div className="p-6">{classId && <ClassActivityTab classId={classId} isOpen={isOpen} />}</div>
          </TabsContent>
        </div>

        {isEditing && activeTab === 'details' && (
          <div className="p-6 border-t bg-background mt-auto shrink-0">
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={() => {
                const form = document.getElementById('class-edit-form') as HTMLFormElement;
                if (form) form.requestSubmit();
              }}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Tabs>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>Delete this class?</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Type <strong>{classData.level || 'DELETE'}</strong> to confirm</Label>
            <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClass} disabled={isDeleting || deleteConfirmText !== (classData.level || 'DELETE')} className="bg-destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SessionModal isOpen={!!nestedSessionId} sessionId={nestedSessionId || ''} onClose={() => setNestedSessionId(null)} />
      {nestedStaffId && <ViewStaffModal isOpen={!!nestedStaffId} staffId={nestedStaffId} onClose={() => setNestedStaffId(null)} onStaffUpdated={onClassUpdated} />}
      {nestedStudentId && <ViewStudentModal isOpen={!!nestedStudentId} studentId={nestedStudentId} onClose={() => setNestedStudentId(null)} onStudentUpdated={onClassUpdated} />}
    </div>
  );
}
