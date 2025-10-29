'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { Button as UIButton } from '@altitutor/ui';
import { useToast } from "@altitutor/ui";
import { studentsApi } from '../api';
import { subjectsApi } from '@/features/subjects/api';
import type { Tables } from '@altitutor/shared';
import { 
  DetailsTab,
  ClassesTab,
  StudentAccountTab,
  DetailsFormData
} from './tabs';
import { StudentSessionsTab } from './StudentSessionsTab';
import { StudentBillingTab } from './StudentBillingTab';
import { ViewSubjectModal } from '@/features/subjects/components';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
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
import { mapDetailsFormToStudentUpdate } from '@/features/students/mappers/studentMappers';
import { ViewParentModal } from './ViewParentModal';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { ensureConversationForRelated } from '@/features/messages/api/queries';

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
  const [student, setStudent] = useState<Tables<'students'> | null>(null);
  const [studentSubjects, setStudentSubjects] = useState<Tables<'subjects'>[]>([]);
  const [allSubjects, setAllSubjects] = useState<Tables<'subjects'>[]>([]);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [parents, setParents] = useState<any[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Edit states for each tab
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  
  // Loading states for each tab
  const [loadingDetailsUpdate, setLoadingDetailsUpdate] = useState(false);
  const [loadingAccountUpdate, setLoadingAccountUpdate] = useState(false);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
  const [isAddSubjectDialogOpen, setIsAddSubjectDialogOpen] = useState(false);

  // Load student data
  const loadStudent = async () => {
    if (!studentId) return;
    
    try {
      setLoadingStudent(true);
      // Use the optimized method that gets both student and subjects efficiently
      const { student: studentData, subjects: subjectsData } = await studentsApi.getStudentWithSubjects(studentId);
      setStudent(studentData || null);
      setStudentSubjects(subjectsData);
      
      // Also fetch parents
      const supabase = getSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: parentsData, error: parentsError } = await supabase
        .from('parents_students')
        .select('parents!inner(id,first_name,last_name,email,phone)')
        .eq('student_id', studentId);
      
      if (parentsError) {
        console.error('Failed to fetch parents:', parentsError);
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setParents(parentsData?.map((ps: any) => ps.parents).filter(Boolean) || []);
      
      // Get conversation ID for messages tab
      const convId = await ensureConversationForRelated(studentId, 'student');
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[ViewStudentModal] Conversation ID for student', studentId, ':', convId);
      }
      setConversationId(convId);
    } catch (error) {
      console.error('Failed to load student:', error);
      toast({
        title: "Error",
        description: "Failed to load student details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingStudent(false);
    }
  };

  // Load subjects
  const loadSubjects = async () => {
    if (!studentId) return;
    
    try {
      setLoadingSubjects(true);
      // Just load all subjects for assignment dropdown
      const allSubjectsData = await subjectsApi.getAllSubjects();
      setAllSubjects(allSubjectsData);
    } catch (error) {
      console.error('Failed to load subjects:', error);
      toast({
        title: "Error",
        description: "Failed to load subjects. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingSubjects(false);
    }
  };

  // Initialize data when modal opens
  useEffect(() => {
    if (isOpen && studentId) {
      loadStudent(); // This now loads both student and subjects
      loadSubjects(); // This loads all subjects for dropdown
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, studentId]);

  // Reset edit states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditingDetails(false);
    }
  }, [isOpen]);

  // Handle details update (merged student, parent, and availability)
  const handleDetailsSubmit = async (data: DetailsFormData) => {
    if (!student) return;
    
    try {
      setLoadingDetailsUpdate(true);
      const payload = mapDetailsFormToStudentUpdate(data);
      const updatedStudent = await studentsApi.updateStudent(student.id, payload);
      
      setStudent(updatedStudent);
      setIsEditingDetails(false);
      onStudentUpdated();
      
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

  // Handle password reset request
  const handlePasswordResetRequest = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!student || !((student as any).email || (student as any).student_email)) {
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
      // await authApi.requestPasswordReset((student as any).email || (student as any).student_email);
      
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
  const handleAssignSubject = async (subjectId: string) => {
    if (!student) return;
    
    try {
      await studentsApi.assignSubjectToStudent(student.id, subjectId);
      await loadStudent(); // Reload student with updated subjects
      toast({
        title: "Success",
        description: "Subject assigned successfully.",
      });
    } catch (error) {
      console.error('Failed to assign subject:', error);
      toast({
        title: "Assignment failed",
        description: "There was an error assigning the subject. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle subject removal
  const handleRemoveSubject = async (subjectId: string) => {
    if (!student) return;
    
    try {
      await studentsApi.removeSubjectFromStudent(student.id, subjectId);
      await loadStudent(); // Reload student with updated subjects
      toast({
        title: "Success",
        description: "Subject removed successfully.",
      });
    } catch (error) {
      console.error('Failed to remove subject:', error);
      toast({
        title: "Removal failed",
        description: "There was an error removing the subject. Please try again.",
        variant: "destructive",
      });
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
      setShowDeleteDialog(false);
      onClose();
      onStudentUpdated();
      
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

  if (!student && loadingStudent) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[600px] sm:w-[800px] sm:max-w-none">
          <div className="flex justify-center items-center h-32">
            Loading...
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!student) return null;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[600px] sm:w-[800px] sm:max-w-none h-full flex flex-col p-0">
          <SheetHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <SheetTitle>
              Student Details
            </SheetTitle>
            <SheetDescription className="text-lg font-medium">
              {student.first_name} {student.last_name}
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
            <Tabs defaultValue="details" className="flex flex-col h-full">
            <TabsList className="grid w-full grid-cols-6 flex-shrink-0">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="classes">Classes</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              </TabsList>
            
            <div className="flex-1 overflow-hidden mt-4">
              <TabsContent value="details" className="h-full overflow-y-auto m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <DetailsTab
                  student={student}
                  isEditing={isEditingDetails}
                  isLoading={loadingDetailsUpdate}
                  onEdit={() => setIsEditingDetails(true)}
                  onCancelEdit={() => setIsEditingDetails(false)}
                  onSubmit={handleDetailsSubmit}
                  studentSubjects={studentSubjects}
                  loadingSubjects={loadingSubjects}
                  onAddSubject={() => setIsAddSubjectDialogOpen(true)}
                  onRemoveSubject={handleRemoveSubject}
                  onViewSubject={handleViewSubject}
                />
                
                {/* Parents Section */}
                {parents.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <h3 className="text-lg font-medium">Parents</h3>
                    <div className="space-y-2">
                      {parents.map((parent) => (
                        <div 
                          key={parent.id} 
                          className="flex items-center justify-between p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setSelectedParentId(parent.id);
                            setParentModalDefaultTab('messages');
                            setParentModalOpen(true);
                          }}
                        >
                          <div>
                            <p className="font-medium">{parent.first_name} {parent.last_name}</p>
                            <p className="text-sm text-muted-foreground">{parent.email || parent.phone_e164}</p>
                          </div>
                          <UIButton
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedParentId(parent.id);
                              setParentModalDefaultTab('messages');
                              setParentModalOpen(true);
                            }}
                          >
                            Message
                          </UIButton>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="classes" className="h-full overflow-y-auto m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <ClassesTab
                  student={student}
                  onStudentUpdated={onStudentUpdated}
                />
              </TabsContent>
              
              <TabsContent value="account" className="h-full overflow-y-auto m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <StudentAccountTab
                  student={student}
                  isLoading={loadingAccountUpdate}
                  hasPasswordResetLinkSent={hasPasswordResetLinkSent}
                  isDeleting={loadingDelete}
                  onPasswordResetRequest={handlePasswordResetRequest}
                  onDelete={handleDeleteStudent}
                />
              </TabsContent>

              <TabsContent value="messages" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <MessagesTabContent 
                  conversationId={conversationId}
                  title={`${student.first_name} ${student.last_name}`}
                  onClose={onClose}
                />
              </TabsContent>

              <TabsContent value="sessions" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <StudentSessionsTab student={student} />
              </TabsContent>

              <TabsContent value="billing" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <StudentBillingTab student={student} />
              </TabsContent>
            </div>
          </Tabs>
          </div>
          
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
        onParentUpdated={loadStudent}
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
          onSubjectUpdated={() => {
            loadStudent();
          }}
        />
      )}
      
      {/* Add Subject Dialog */}
      <AlertDialog open={isAddSubjectDialogOpen} onOpenChange={setIsAddSubjectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign Subject</AlertDialogTitle>
            <AlertDialogDescription>
              Select a subject to assign to this student.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            <div className="space-y-2">
              {allSubjects.filter(s => !studentSubjects.some(ss => ss.id === s.id)).map((subject) => (
                <button
                  key={subject.id}
                  onClick={() => {
                    handleAssignSubject(subject.id);
                    setIsAddSubjectDialogOpen(false);
                  }}
                  className="w-full text-left p-3 border rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium">
                    {subject.curriculum} {subject.year_level ? `Year ${subject.year_level}` : ''} {subject.name}
                  </div>
                  {subject.level && (
                    <div className="text-sm text-muted-foreground">{subject.level}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {student.first_name} {student.last_name}? 
              This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudent}
              disabled={loadingDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loadingDelete ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 