'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Loader2, ArrowLeft } from "lucide-react";
import { useQueryClient } from '@tanstack/react-query';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ParentDetailsTab, ParentDetailsFormData } from '@/features/students/components/tabs/ParentDetailsTab';
import { studentsApi } from '@/features/students/api/students';
import { useStudents } from '@/features/students/hooks/useStudentsQuery';
import { StudentSearchPopover } from '@/features/students/components/StudentSearchPopover';
import { ParentActivityTab } from '@/features/activity/components/tabs/ParentActivityTab';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';
import { useParentDetails, parentsKeys } from '@/features/parents/hooks/useParentsQuery';
import type { Tables } from '@altitutor/shared';

export default function ParentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: parentData, isLoading } = useParentDetails(id, !!id);
  const { data: allStudents = [] } = useStudents();
  
  const parent = parentData?.parent || null;
  const students = parentData?.students || [];
  
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Edit states
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [loadingDetailsUpdate, setLoadingDetailsUpdate] = useState(false);
  
  // Temporary students state for editing (not saved until form submit)
  const [tempParentStudents, setTempParentStudents] = useState<Tables<'students'>[]>([]);
  const [studentsToAdd, setStudentsToAdd] = useState<string[]>([]);
  const [studentsToRemove, setStudentsToRemove] = useState<string[]>([]);

  // Load conversation ID
  useEffect(() => {
    const loadConversation = async () => {
      if (id) {
        const convId = await getExistingConversationForRelated(id, 'parent');
        setConversationId(convId);
      }
    };
    loadConversation();
  }, [id]);

  const handleStudentClick = (studentId: string) => {
    setSelectedStudentId(studentId);
    setStudentModalOpen(true);
  };

  // Handle starting edit mode
  const handleStartEditDetails = () => {
    setTempParentStudents([...students]);
    setStudentsToAdd([]);
    setStudentsToRemove([]);
    setIsEditingDetails(true);
  };

  // Handle canceling edit mode
  const handleCancelEditDetails = () => {
    setTempParentStudents([]);
    setStudentsToAdd([]);
    setStudentsToRemove([]);
    setIsEditingDetails(false);
  };

  // Handle details update
  const handleDetailsSubmit = async (data: ParentDetailsFormData) => {
    if (!parent) return;
    
    try {
      setLoadingDetailsUpdate(true);
      
      // Update parent information
      await studentsApi.updateParent(parent.id, {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
      });
      
      // Apply student changes
      for (const studentId of studentsToAdd) {
        await studentsApi.assignStudentToParent(parent.id, studentId);
      }
      for (const studentId of studentsToRemove) {
        await studentsApi.removeStudentFromParent(parent.id, studentId);
      }
      
      // Clear temporary student changes
      setStudentsToAdd([]);
      setStudentsToRemove([]);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: parentsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: parentsKeys.lists() });
      
      setIsEditingDetails(false);
      
      toast({
        title: "Success",
        description: "Details updated successfully.",
      });
    } catch (error) {
      console.error('Failed to update details:', error);
      toast({
        title: "Error",
        description: "Failed to update details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingDetailsUpdate(false);
    }
  };

  // Handle student assignment (in edit mode - temporary)
  const handleAssignStudent = (student: Tables<'students'>) => {
    if (!student) return;
    
    // Add to temporary students list
    setTempParentStudents(prev => [...prev, student]);
    
    // Track as added (unless it was previously marked for removal)
    if (studentsToRemove.includes(student.id)) {
      setStudentsToRemove(prev => prev.filter(id => id !== student.id));
    } else {
      setStudentsToAdd(prev => [...prev, student.id]);
    }
  };

  // Handle student removal (in edit mode - temporary)
  const handleRemoveStudent = (studentId: string) => {
    // Remove from temporary students list
    setTempParentStudents(prev => prev.filter(s => s.id !== studentId));
    
    // Track as removed (unless it was previously marked for addition)
    if (studentsToAdd.includes(studentId)) {
      setStudentsToAdd(prev => prev.filter(id => id !== studentId));
    } else {
      setStudentsToRemove(prev => [...prev, studentId]);
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
            {isEditingDetails ? 'Edit Parent' : 'Parent Details'}
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            {parent.first_name} {parent.last_name}
          </p>
        </div>
        <ActionsMenu
          type="parent"
          onOpenInPage={() => {
            router.push(`/parents/${id}`);
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
            onViewStudent={handleStudentClick}
            isEditing={isEditingDetails}
            isLoading={loadingDetailsUpdate}
            onEdit={handleStartEditDetails}
            onCancelEdit={handleCancelEditDetails}
            onSubmit={handleDetailsSubmit}
            parentStudents={isEditingDetails ? tempParentStudents : students}
            onRemoveStudent={handleRemoveStudent}
            addStudentButton={
              isEditingDetails ? (
                <StudentSearchPopover
                  allStudents={allStudents}
                  selectedStudents={tempParentStudents}
                  onSelectStudent={handleAssignStudent}
                />
              ) : undefined
            }
          />
          {isEditingDetails && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleCancelEditDetails} disabled={loadingDetailsUpdate}>
                Cancel
              </Button>
              <Button 
                disabled={loadingDetailsUpdate}
                onClick={() => {
                  const form = document.getElementById('parent-edit-form') as HTMLFormElement;
                  if (form) {
                    form.requestSubmit();
                  }
                }}
              >
                {loadingDetailsUpdate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
      <ViewStudentModal
        isOpen={studentModalOpen}
        onClose={() => {
          setStudentModalOpen(false);
          setSelectedStudentId(null);
        }}
        studentId={selectedStudentId}
        onStudentUpdated={() => {
          queryClient.invalidateQueries({ queryKey: parentsKeys.detail(id) });
        }}
      />
    </div>
  );
}
