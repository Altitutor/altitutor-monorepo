'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { Tables } from '@altitutor/shared';
import { 
  DetailsTab,
  StudentSubjectsTab, 
  ClassesTab,
  StudentAccountTab,
  DetailsFormData,
  StudentAccountFormData
} from './tabs';
import { studentsApi } from '../api';
import { subjectsApi } from '@/features/subjects/api';
import { mapDetailsFormToStudentUpdate, mapAccountFormToStudentUpdate } from '@/features/students/mappers/studentMappers';

interface ViewParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string | null;
  onParentUpdated?: () => void;
}

export function ViewParentModal({
  isOpen,
  onClose,
  parentId,
  onParentUpdated
}: ViewParentModalProps) {
  const { toast } = useToast();
  const [parent, setParent] = useState<any | null>(null);
  const [students, setStudents] = useState<Tables<'students'>[]>([]);
  const [allSubjects, setAllSubjects] = useState<Tables<'subjects'>[]>([]);
  const [loadingParent, setLoadingParent] = useState(false);
  const [activeStudentTab, setActiveStudentTab] = useState<string>('');
  
  // Edit states for each student's tabs
  const [editingStates, setEditingStates] = useState<Record<string, { details: boolean; account: boolean }>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, { details: boolean; account: boolean }>>({});

  // Load parent data
  const loadParent = async () => {
    if (!parentId) return;
    
    try {
      setLoadingParent(true);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('parents')
        .select(`
          *,
          parents_students (
            id,
            students (*)
          )
        `)
        .eq('id', parentId)
        .maybeSingle();
      
      if (error) throw error;
      setParent(data);
      
      // Extract students from the join
      const studentsList = data?.parents_students?.map((ps: any) => ps.students).filter(Boolean) || [];
      setStudents(studentsList);
      
      // Set initial active tab to first student
      if (studentsList.length > 0 && !activeStudentTab) {
        setActiveStudentTab(studentsList[0].id);
      }
    } catch (error) {
      console.error('Failed to load parent:', error);
      toast({
        title: "Error",
        description: "Failed to load parent details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingParent(false);
    }
  };

  // Load subjects
  const loadSubjects = async () => {
    try {
      const allSubjectsData = await subjectsApi.getAllSubjects();
      setAllSubjects(allSubjectsData);
    } catch (error) {
      console.error('Failed to load subjects:', error);
    }
  };

  // Initialize data when modal opens
  useEffect(() => {
    if (isOpen && parentId) {
      loadParent();
      loadSubjects();
    }
  }, [isOpen, parentId]);

  // Reset edit states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEditingStates({});
      setLoadingStates({});
      setActiveStudentTab('');
    }
  }, [isOpen]);

  // Handle details update for a student
  const handleDetailsSubmit = async (studentId: string, data: DetailsFormData) => {
    try {
      setLoadingStates(prev => ({ ...prev, [studentId]: { ...prev[studentId], details: true } }));
      const payload = mapDetailsFormToStudentUpdate(data);
      await studentsApi.updateStudent(studentId, payload);
      
      // Reload parent to refresh student data
      await loadParent();
      setEditingStates(prev => ({ ...prev, [studentId]: { ...prev[studentId], details: false } }));
      if (onParentUpdated) onParentUpdated();
      
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
      setLoadingStates(prev => ({ ...prev, [studentId]: { ...prev[studentId], details: false } }));
    }
  };

  // Handle account update for a student
  const handleAccountSubmit = async (studentId: string, data: StudentAccountFormData) => {
    try {
      setLoadingStates(prev => ({ ...prev, [studentId]: { ...prev[studentId], account: true } }));
      const payload = mapAccountFormToStudentUpdate(data);
      await studentsApi.updateStudent(studentId, payload);
      
      // Reload parent to refresh student data
      await loadParent();
      setEditingStates(prev => ({ ...prev, [studentId]: { ...prev[studentId], account: false } }));
      if (onParentUpdated) onParentUpdated();
      
      toast({
        title: "Success",
        description: "Account information updated successfully.",
      });
    } catch (error) {
      console.error('Failed to update account:', error);
      toast({
        title: "Error",
        description: "Failed to update account information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [studentId]: { ...prev[studentId], account: false } }));
    }
  };

  // Handle subject assignment
  const handleAssignSubject = async (studentId: string, subjectId: string) => {
    try {
      await studentsApi.assignSubjectToStudent(studentId, subjectId);
      await loadParent();
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
  const handleRemoveSubject = async (studentId: string, subjectId: string) => {
    try {
      await studentsApi.removeSubjectFromStudent(studentId, subjectId);
      await loadParent();
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

  if (!parent && loadingParent) {
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

  if (!parent) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:w-[800px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>
            {parent.first_name} {parent.last_name}
          </SheetTitle>
        </SheetHeader>
        
        {/* Parent Details */}
        <div className="mt-6 space-y-2">
          <div className="text-sm">
            <span className="font-medium text-muted-foreground">Email:</span>{' '}
            <span>{parent.email || '-'}</span>
          </div>
          <div className="text-sm">
            <span className="font-medium text-muted-foreground">Phone:</span>{' '}
            <span>{parent.phone || '-'}</span>
          </div>
          <div className="text-sm">
            <span className="font-medium text-muted-foreground">Students:</span>{' '}
            <span>{students.map(s => `${s.first_name} ${s.last_name}`).join(', ')}</span>
          </div>
        </div>
        
        {/* Student Tabs */}
        {students.length > 0 && (
          <Tabs value={activeStudentTab} onValueChange={setActiveStudentTab} className="mt-6 flex flex-col h-[calc(100vh-300px)]">
            <TabsList className={`grid w-full grid-cols-${Math.min(students.length, 4)}`}>
              {students.map((student) => (
                <TabsTrigger key={student.id} value={student.id}>
                  {student.first_name}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {students.map((student) => (
              <TabsContent key={student.id} value={student.id} className="flex-1 overflow-hidden">
                <Tabs defaultValue="details" className="flex flex-col h-full">
                  <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="subjects">Subjects</TabsTrigger>
                    <TabsTrigger value="classes">Classes</TabsTrigger>
                    <TabsTrigger value="account">Account</TabsTrigger>
                  </TabsList>
                  
                  <div className="flex-1 overflow-y-auto">
                    <TabsContent value="details" className="mt-6">
                      <DetailsTab
                        student={student}
                        isEditing={editingStates[student.id]?.details || false}
                        isLoading={loadingStates[student.id]?.details || false}
                        onEdit={() => setEditingStates(prev => ({ ...prev, [student.id]: { ...prev[student.id], details: true } }))}
                        onCancelEdit={() => setEditingStates(prev => ({ ...prev, [student.id]: { ...prev[student.id], details: false } }))}
                        onSubmit={(data) => handleDetailsSubmit(student.id, data)}
                      />
                    </TabsContent>
                    
                    <TabsContent value="subjects" className="mt-6">
                      <StudentSubjectsTab
                        student={student}
                        studentSubjects={(student as any).subjects || []}
                        allSubjects={allSubjects}
                        loadingSubjects={false}
                        onAssignSubject={(subjectId) => handleAssignSubject(student.id, subjectId)}
                        onRemoveSubject={(subjectId) => handleRemoveSubject(student.id, subjectId)}
                      />
                    </TabsContent>
                    
                    <TabsContent value="classes" className="mt-6">
                      <ClassesTab
                        student={student}
                        onStudentUpdated={loadParent}
                      />
                    </TabsContent>
                    
                    <TabsContent value="account" className="mt-6">
                      <StudentAccountTab
                        student={student}
                        isLoading={loadingStates[student.id]?.account || false}
                        isEditingAccount={editingStates[student.id]?.account || false}
                        hasPasswordResetLinkSent={false}
                        isDeleting={false}
                        onEditAccount={() => setEditingStates(prev => ({ ...prev, [student.id]: { ...prev[student.id], account: true } }))}
                        onCancelEditAccount={() => setEditingStates(prev => ({ ...prev, [student.id]: { ...prev[student.id], account: false } }))}
                        onAccountUpdate={(data) => handleAccountSubmit(student.id, data)}
                        onPasswordResetRequest={async () => {}}
                        onDelete={async () => {}}
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

