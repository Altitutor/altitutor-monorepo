'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Loader2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { studentsApi } from '../api';
import { useStudentDetails, useUpdateStudent, studentsKeys } from '../hooks/useStudentsQuery';
import { useSubjects } from '@/features/subjects';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@altitutor/shared';
import { 
  DetailsTab,
  ClassesTab,
  DetailsFormData
} from './tabs';
import { StudentSessionsTab } from './StudentSessionsTab';
import { StudentBillingTab } from './StudentBillingTab';
import { ViewSubjectModal, SubjectSearchPopover } from '@/features/subjects/components';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { mapDetailsFormToStudentUpdate } from '@/features/students/mappers/studentMappers';
import { ViewParentModal } from './ViewParentModal';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';
import { ParentSearchPopover } from './ParentSearchPopover';
import { Notes } from '@/shared/components/Notes';
import { useNotes } from '@/shared/hooks/useNotes';
import { Separator } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';

interface ViewStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  onStudentUpdated: () => void;
}

export function ViewStudentModal({
  isOpen,
  onClose,
  studentId,
  onStudentUpdated
}: ViewStudentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  
  // Use React Query hooks for data fetching
  const { data: studentDetails, isLoading: loadingStudent } = useStudentDetails(studentId || '', isOpen && !!studentId);
  const { data: allSubjects = [] } = useSubjects();
  const updateStudentMutation = useUpdateStudent();
  const { data: notes = [] } = useNotes('students', studentId || '', isOpen && !!studentId);
  
  // Extract data from studentDetails
  const student = studentDetails?.student || null;
  const studentSubjects = studentDetails?.subjects || [];
  const parents = studentDetails?.parents || [];
  const _upcomingSessions = studentDetails?.upcomingSessions || [];
  const _billingStatus = studentDetails?.billingStatus;
  
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
    if (isOpen && isEditingDetails) {
      studentsApi.getAllParents().then(setAllParents).catch(console.error);
    }
  }, [isOpen, isEditingDetails]);

  // Get existing conversation ID for messages tab when modal opens
  useEffect(() => {
    if (isOpen && studentId) {
      getExistingConversationForRelated(studentId, 'student').then((convId) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[ViewStudentModal] Existing conversation ID for student', studentId, ':', convId);
      }
      setConversationId(convId);
      });
    } else if (!isOpen) {
      setConversationId(null);
    }
  }, [isOpen, studentId]);

  // Reset edit states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditingDetails(false);
      setActiveTab('details');
    }
  }, [isOpen]);

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

  // Handle details update (merged student, parent, and availability)
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
      
      // Invalidate student details query to refetch with updated subjects and parents
      queryClient.invalidateQueries({ queryKey: studentsKeys.detailFull(student.id) });
      
      setIsEditingDetails(false);
      onStudentUpdated();
      
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
      // TODO: Implement password reset API call
      // await authApi.requestPasswordReset(student.email);
      
      setHasPasswordResetLinkSent(true);
      
      toast({
        title: "Success",
        description: "Password reset link sent successfully.",
      });
    } catch (error) {
      console.error('Failed to send password reset:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to send password reset link. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoadingAccountUpdate(false);
    }
  };

  // Handle subject assignment (in edit mode - temporary)
  const handleAssignSubject = (subject: Tables<'subjects'>) => {
    if (!subject) return;
    
    // Add to temporary subjects list
    setTempStudentSubjects(prev => [...prev, subject]);
    
    // Track as added (unless it was previously marked for removal)
    if (subjectsToRemove.includes(subject.id)) {
      setSubjectsToRemove(prev => prev.filter(id => id !== subject.id));
    } else {
      setSubjectsToAdd(prev => [...prev, subject.id]);
    }
  };

  // Handle subject removal (in edit mode - temporary)
  const handleRemoveSubject = (subjectId: string) => {
    // Remove from temporary subjects list
    setTempStudentSubjects(prev => prev.filter(s => s.id !== subjectId));
    
    // Track as removed (unless it was previously marked for addition)
    if (subjectsToAdd.includes(subjectId)) {
      setSubjectsToAdd(prev => prev.filter(id => id !== subjectId));
    } else {
      setSubjectsToRemove(prev => [...prev, subjectId]);
    }
  };
  
  // Handle parent assignment (in edit mode - temporary)
  const handleAssignParent = (parent: Tables<'parents'>) => {
    if (!parent) return;
    
    // Add to temporary parents list
    setTempStudentParents(prev => [...prev, parent]);
    
    // Track as added (unless it was previously marked for removal)
    if (parentsToRemove.includes(parent.id)) {
      setParentsToRemove(prev => prev.filter(id => id !== parent.id));
    } else {
      setParentsToAdd(prev => [...prev, parent.id]);
    }
  };

  // Handle parent removal (in edit mode - temporary)
  const handleRemoveParent = (parentId: string) => {
    // Remove from temporary parents list
    setTempStudentParents(prev => prev.filter(p => p.id !== parentId));
    
    // Track as removed (unless it was previously marked for addition)
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
      onClose();
      onStudentUpdated();
      
      toast({
        title: "Success",
        description: "Student deleted successfully.",
      });
    } catch (error) {
      console.error('Failed to delete student:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to delete student. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoadingDelete(false);
    }
  };

  // Always render the Sheet to allow exit animation
  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full md:w-[600px] lg:w-[800px] md:max-w-none h-full max-h-[100vh] flex flex-col p-0">
          {!student ? (
            <div className="flex justify-center items-center h-full p-6">
              <div className="text-muted-foreground">
                {loadingStudent ? 'Loading...' : ''}
              </div>
            </div>
          ) : (
            <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
              {/* Sticky Header */}
              <div className="flex-shrink-0 border-b bg-background sticky top-0 z-10">
                <SheetHeader className="px-6 pt-6 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <SheetTitle>
                        {isEditingDetails ? 'Edit Student' : 'Student Details'}
                      </SheetTitle>
                      <SheetDescription className="text-lg font-medium flex items-center gap-2">
                        {student.first_name} {student.last_name}
                        <Badge 
                          variant={
                            student.status === 'ACTIVE' ? 'success' :
                            student.status === 'TRIAL' ? 'secondary' :
                            student.status === 'DISCONTINUED' ? 'destructive' :
                            'outline'
                          }
                          className="text-xs"
                        >
                          {student.status}
                        </Badge>
                      </SheetDescription>
                    </div>
                    {studentId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          router.push(`/students/${studentId}`);
                          onClose();
                        }}
                        className="shrink-0"
                        title="Open in new page"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </SheetHeader>
                <div className="px-6 pb-4">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="classes">Classes</TabsTrigger>
                    <TabsTrigger value="messages">Messages</TabsTrigger>
                    <TabsTrigger value="sessions">Sessions</TabsTrigger>
                    <TabsTrigger value="billing">Billing</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 min-h-0 relative">
                <TabsContent value="details" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="p-6">
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
                  </div>
                </TabsContent>
              
                <TabsContent value="classes" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="p-6">
                    <ClassesTab
                      student={student}
                      onStudentUpdated={onStudentUpdated}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="messages" className="absolute inset-0 overflow-hidden m-0 p-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="h-full p-6">
                    <MessagesTabContent 
                      conversationId={conversationId}
                      title={`${student.first_name} ${student.last_name}`}
                      onClose={onClose}
                      relatedId={studentId || undefined}
                      relatedType="student"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="sessions" className="absolute inset-0 overflow-hidden m-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="h-full p-6">
                    <StudentSessionsTab student={student} />
                  </div>
                </TabsContent>

                <TabsContent value="billing" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="p-6">
                    <StudentBillingTab student={student} />
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="p-6">
                    <Notes
                      targetType="students"
                      targetId={studentId || ''}
                      notes={notes}
                      onNoteAdded={() => {
                        queryClient.invalidateQueries({ queryKey: ['notes', 'students', studentId] });
                      }}
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          )}
          
          {/* Sticky Footer with Buttons */}
          {student && isEditingDetails && activeTab === 'details' && (
            <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
              <div className="flex w-full justify-end">
                <div className="flex space-x-2">
                  <Button variant="outline" type="button" onClick={handleCancelEditDetails} disabled={loadingDetailsUpdate}>
                    Cancel
                  </Button>
                  <Button 
                    type="button"
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
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Parent Modal */}
      <ViewParentModal
        isOpen={parentModalOpen}
        onClose={() => {
          setParentModalOpen(false);
          setSelectedParentId(null);
          setParentModalDefaultTab('students');
        }}
        parentId={selectedParentId}
        onParentUpdated={onStudentUpdated}
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
          onSubjectUpdated={onStudentUpdated}
        />
      )}
      
    </>
  );
} 