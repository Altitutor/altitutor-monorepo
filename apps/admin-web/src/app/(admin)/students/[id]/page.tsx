'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Loader2, ArrowLeft } from "lucide-react";
import { studentsApi } from '@/features/students/api';
import { useStudentDetails, useUpdateStudent, studentsKeys } from '@/features/students/hooks/useStudentsQuery';
import { useSubjects } from '@/features/subjects';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@altitutor/shared';
import { 
  DetailsTab,
  ClassesTab,
  DetailsFormData
} from '@/features/students/components/tabs';
import { StudentSessionsTab } from '@/features/students/components/StudentSessionsTab';
import { StudentBillingTab } from '@/features/students/components/StudentBillingTab';
import { ViewSubjectModal, SubjectSearchPopover } from '@/features/subjects/components';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { mapDetailsFormToStudentUpdate } from '@/features/students/mappers/studentMappers';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';
import { ParentSearchPopover } from '@/features/students/components/ParentSearchPopover';
import { StudentActivityTab } from '@/features/activity/components/tabs/StudentActivityTab';

export default function StudentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Use React Query hooks for data fetching
  const { data: studentDetails, isLoading: loadingStudent } = useStudentDetails(id, !!id);
  const updateStudentMutation = useUpdateStudent();
  
  // Extract data from studentDetails
  const student = studentDetails?.student || null;
  const studentSubjects = studentDetails?.subjects || [];
  const parents = studentDetails?.parents || [];
  
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Edit states for each tab
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  
  // Loading states for each tab
  const [loadingDetailsUpdate, setLoadingDetailsUpdate] = useState(false);
  const [loadingAccountUpdate, setLoadingAccountUpdate] = useState(false);

  // Delete state
  const [loadingDelete, setLoadingDelete] = useState(false);

  // Password reset state
  const [hasPasswordResetLinkSent, setHasPasswordResetLinkSent] = useState(false);
  
  // Parent modal state
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [parentModalOpen, setParentModalOpen] = useState(false);
  const [parentModalDefaultTab, setParentModalDefaultTab] = useState<string>('students');
  
  // Subject modal state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);

  // Temporary subjects state for editing (not saved until form submit)
  const [tempStudentSubjects, setTempStudentSubjects] = useState<Tables<'subjects'>[]>([]);
  const [subjectsToAdd, setSubjectsToAdd] = useState<string[]>([]);
  const [subjectsToRemove, setSubjectsToRemove] = useState<string[]>([]);

  // Temporary parents state for editing (not saved until form submit)
  const [tempStudentParents, setTempStudentParents] = useState<Tables<'parents'>[]>([]);
  const [parentsToAdd, setParentsToAdd] = useState<string[]>([]);
  const [parentsToRemove, setParentsToRemove] = useState<string[]>([]);

  // Get all parents for the search popover
  const [allParents, setAllParents] = useState<Tables<'parents'>[]>([]);
  useEffect(() => {
    if (isEditingDetails) {
      studentsApi.getAllParents().then(setAllParents).catch(console.error);
    }
  }, [isEditingDetails]);

  // Get existing conversation ID for messages tab
  useEffect(() => {
    if (id) {
      getExistingConversationForRelated(id, 'student').then((convId) => {
        setConversationId(convId);
      });
    }
  }, [id]);

  // Handle starting edit mode
  const handleStartEditDetails = () => {
    setTempStudentSubjects([...studentSubjects]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setTempStudentParents([...parents]);
    setParentsToAdd([]);
    setParentsToRemove([]);
    setIsEditingDetails(true);
  };

  // Handle canceling edit mode
  const handleCancelEditDetails = () => {
    setTempStudentSubjects([]);
    setSubjectsToAdd([]);
    setSubjectsToRemove([]);
    setIsEditingDetails(false);
  };

  // Handle details update
  const handleDetailsSubmit = async (data: DetailsFormData) => {
    if (!student) return;
    
    try {
      setLoadingDetailsUpdate(true);
      const payload = mapDetailsFormToStudentUpdate(data);
      await updateStudentMutation.mutateAsync({ id: student.id, data: payload });
      
      // Apply subject changes
      for (const subjectId of subjectsToAdd) {
        await studentsApi.assignSubjectToStudent(student.id, subjectId);
      }
      for (const subjectId of subjectsToRemove) {
        await studentsApi.removeSubjectFromStudent(student.id, subjectId);
      }
      
      // Apply parent changes
      for (const parentId of parentsToAdd) {
        await studentsApi.assignParentToStudent(student.id, parentId);
      }
      for (const parentId of parentsToRemove) {
        await studentsApi.removeParentFromStudent(student.id, parentId);
      }
      
      // Clear temporary changes
      setSubjectsToAdd([]);
      setSubjectsToRemove([]);
      setParentsToAdd([]);
      setParentsToRemove([]);
      
      // Invalidate student details query
      queryClient.invalidateQueries({ queryKey: studentsKeys.detailFull(student.id) });
      
      setIsEditingDetails(false);
      
      toast({
        title: "Success",
        description: "Details updated successfully.",
      });
    } catch (error) {
      console.error('Failed to update details:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to update details. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoadingDetailsUpdate(false);
    }
  };

  // Handle password reset request
  const handlePasswordResetRequest = async () => {
    if (!student || !student.email) {
      toast({
        title: "Error",
        description: "No email address found for this student.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoadingAccountUpdate(true);
      setHasPasswordResetLinkSent(true);
      
      toast({
        title: "Success",
        description: "Password reset link sent successfully.",
      });
    } catch (error) {
      console.error('Failed to send password reset:', error);
      toast({
        title: "Error",
        description: "Failed to send password reset link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingAccountUpdate(false);
    }
  };

  // Handle subject assignment
  const handleAssignSubject = (subject: Tables<'subjects'>) => {
    if (!subject) return;
    setTempStudentSubjects(prev => [...prev, subject]);
    if (subjectsToRemove.includes(subject.id)) {
      setSubjectsToRemove(prev => prev.filter(id => id !== subject.id));
    } else {
      setSubjectsToAdd(prev => [...prev, subject.id]);
    }
  };

  // Handle subject removal
  const handleRemoveSubject = (subjectId: string) => {
    setTempStudentSubjects(prev => prev.filter(s => s.id !== subjectId));
    if (subjectsToAdd.includes(subjectId)) {
      setSubjectsToAdd(prev => prev.filter(id => id !== subjectId));
    } else {
      setSubjectsToRemove(prev => [...prev, subjectId]);
    }
  };
  
  // Handle parent assignment
  const handleAssignParent = (parent: Tables<'parents'>) => {
    if (!parent) return;
    setTempStudentParents(prev => [...prev, parent]);
    if (parentsToRemove.includes(parent.id)) {
      setParentsToRemove(prev => prev.filter(id => id !== parent.id));
    } else {
      setParentsToAdd(prev => [...prev, parent.id]);
    }
  };

  // Handle parent removal
  const handleRemoveParent = (parentId: string) => {
    setTempStudentParents(prev => prev.filter(p => p.id !== parentId));
    if (parentsToAdd.includes(parentId)) {
      setParentsToAdd(prev => prev.filter(id => id !== parentId));
    } else {
      setParentsToRemove(prev => [...prev, parentId]);
    }
  };

  // Handle viewing subject details
  const handleViewSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSubjectModalOpen(true);
  };

  // Handle student deletion
  const handleDeleteStudent = async () => {
    if (!student) return;
    
    try {
      setLoadingDelete(true);
      await studentsApi.deleteStudent(student.id);
      router.push('/students');
      
      toast({
        title: "Success",
        description: "Student deleted successfully.",
      });
    } catch (error) {
      console.error('Failed to delete student:', error);
      toast({
        title: "Error",
        description: "Failed to delete student. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingDelete(false);
    }
  };

  const handleStudentUpdated = () => {
    queryClient.invalidateQueries({ queryKey: studentsKeys.detailFull(id) });
  };

  if (loadingStudent) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/students')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Student Not Found</h1>
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
          onClick={() => router.push('/students')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditingDetails ? 'Edit Student' : 'Student Details'}
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            {student.first_name} {student.last_name}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <DetailsTab
            student={student}
            isEditing={isEditingDetails}
            isLoading={loadingDetailsUpdate}
            onEdit={handleStartEditDetails}
            onCancelEdit={handleCancelEditDetails}
            onSubmit={handleDetailsSubmit}
            onDelete={isEditingDetails ? handleDeleteStudent : undefined}
            isDeleting={loadingDelete}
            studentSubjects={isEditingDetails ? tempStudentSubjects : studentSubjects}
            loadingSubjects={false}
            onRemoveSubject={handleRemoveSubject}
            onViewSubject={handleViewSubject}
            addSubjectButton={
              <SubjectSearchPopover
                selectedSubjects={isEditingDetails ? tempStudentSubjects : studentSubjects}
                onSelectSubject={handleAssignSubject}
              />
            }
            parents={isEditingDetails ? tempStudentParents : parents}
            onViewParent={(parentId) => {
              setSelectedParentId(parentId);
              setParentModalDefaultTab('messages');
              setParentModalOpen(true);
            }}
            onRemoveParent={isEditingDetails ? handleRemoveParent : undefined}
            addParentButton={
              isEditingDetails ? (
                <ParentSearchPopover
                  allParents={allParents}
                  selectedParents={tempStudentParents}
                  onSelectParent={handleAssignParent}
                />
              ) : undefined
            }
            isLoadingAccount={loadingAccountUpdate}
            hasPasswordResetLinkSent={hasPasswordResetLinkSent}
            onPasswordResetRequest={handlePasswordResetRequest}
          />
          {isEditingDetails && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleCancelEditDetails} disabled={loadingDetailsUpdate}>
                Cancel
              </Button>
              <Button 
                disabled={loadingDetailsUpdate}
                onClick={() => {
                  const form = document.getElementById('student-edit-form') as HTMLFormElement;
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

        <TabsContent value="classes" className="space-y-6">
          <ClassesTab
            student={student}
            onStudentUpdated={handleStudentUpdated}
          />
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <div className="h-[calc(100vh-400px)]">
            <MessagesTabContent 
              conversationId={conversationId}
              title={`${student.first_name} ${student.last_name}`}
              onClose={() => router.push('/students')}
              relatedId={id}
              relatedType="student"
            />
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <StudentSessionsTab student={student} />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <StudentBillingTab student={student} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <StudentActivityTab studentId={id} isOpen={true} />
        </TabsContent>
      </Tabs>

      {/* Parent Modal */}
      <ViewParentModal
        isOpen={parentModalOpen}
        onClose={() => {
          setParentModalOpen(false);
          setSelectedParentId(null);
          setParentModalDefaultTab('students');
        }}
        parentId={selectedParentId}
        onParentUpdated={handleStudentUpdated}
        defaultTab={parentModalDefaultTab}
      />
      
      {/* Subject Modal */}
      {selectedSubjectId && (
        <ViewSubjectModal
          isOpen={subjectModalOpen}
          onClose={() => {
            setSubjectModalOpen(false);
            setSelectedSubjectId(null);
          }}
          subjectId={selectedSubjectId}
          onSubjectUpdated={handleStudentUpdated}
        />
      )}
    </div>
  );
}
