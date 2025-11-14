'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Button } from "@altitutor/ui";
import { Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';
import { ViewStudentModal } from './ViewStudentModal';
import { ParentDetailsTab, ParentDetailsFormData } from './tabs/ParentDetailsTab';
import { studentsApi } from '../api/students';
import { useStudents } from '../hooks/useStudentsQuery';
import { StudentSearchPopover } from './StudentSearchPopover';
import { useQueryClient } from '@tanstack/react-query';

interface ViewParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string | null;
  onParentUpdated?: () => void;
  defaultTab?: string; // Keep for backwards compatibility but won't use it
}

export function ViewParentModal({
  isOpen,
  onClose,
  parentId,
  onParentUpdated,
}: ViewParentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [parent, setParent] = useState<Tables<'parents'> | null>(null);
  const [students, setStudents] = useState<Tables<'students'>[]>([]);
  const [loadingParent, setLoadingParent] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);

  // Edit states
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [loadingDetailsUpdate, setLoadingDetailsUpdate] = useState(false);

  // Get all students for the search popover
  const { data: allStudents = [] } = useStudents();

  // Temporary students state for editing (not saved until form submit)
  const [tempParentStudents, setTempParentStudents] = useState<Tables<'students'>[]>([]);
  const [studentsToAdd, setStudentsToAdd] = useState<string[]>([]);
  const [studentsToRemove, setStudentsToRemove] = useState<string[]>([]);

  // Load parent data
  const loadParent = async () => {
    if (!parentId) return;
    
    try {
      setLoadingParent(true);
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
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
      setParent(data as Tables<'parents'>);
      
      // Extract students from the join
      const studentsList = data?.parents_students?.map((ps: any) => ps.students).filter(Boolean) || [];
      setStudents(studentsList);
      
      // Get existing conversation ID for messages tab (don't create new one)
      const convId = await getExistingConversationForRelated(parentId, 'parent');
      setConversationId(convId);
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

  // Initialize data when modal opens
  useEffect(() => {
    if (isOpen && parentId) {
      loadParent();
    }
  }, [isOpen, parentId]);

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setParent(null);
      setStudents([]);
      setConversationId(null);
      setSelectedStudentId(null);
      setIsEditingDetails(false);
      setActiveTab('details');
      setTempParentStudents([]);
      setStudentsToAdd([]);
      setStudentsToRemove([]);
    }
  }, [isOpen]);

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
      
      // Reload parent data
      await loadParent();
      
      setIsEditingDetails(false);
      onParentUpdated?.();
      
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
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[600px] sm:w-[800px] sm:max-w-none h-full flex flex-col p-0">
          {!parent ? (
            <div className="flex justify-center items-center h-full p-6">
              <div className="text-muted-foreground">
                {loadingParent ? 'Loading...' : ''}
              </div>
            </div>
          ) : (
            <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
              {/* Sticky Header */}
              <div className="flex-shrink-0 border-b bg-background sticky top-0 z-10">
                <SheetHeader className="px-6 pt-6 pb-4">
                  <SheetTitle>
                    {isEditingDetails ? 'Edit Parent' : 'Parent Details'}
                  </SheetTitle>
                  <SheetDescription className="text-lg font-medium">
                    {parent.first_name} {parent.last_name}
                  </SheetDescription>
                </SheetHeader>
                <div className="px-6 pb-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="messages">Messages</TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 min-h-0 relative">
                <TabsContent value="details" className="absolute inset-0 overflow-y-auto m-0 hidden data-[state=active]:block">
                  <div className="px-6 pb-6 pt-0">
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
                  </div>
                </TabsContent>

                <TabsContent value="messages" className="absolute inset-0 overflow-hidden m-0 p-0 hidden data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="h-full px-6 pb-6 pt-0">
                    <MessagesTabContent 
                      conversationId={conversationId}
                      title={`${parent.first_name} ${parent.last_name}`}
                      onClose={onClose}
                      relatedId={parentId || undefined}
                      relatedType="parent"
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          )}

          {/* Sticky Footer with Buttons */}
          {parent && isEditingDetails && activeTab === 'details' && (
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
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Student Modal */}
      <ViewStudentModal
        isOpen={studentModalOpen}
        onClose={() => {
          setStudentModalOpen(false);
          setSelectedStudentId(null);
        }}
        studentId={selectedStudentId}
        onStudentUpdated={() => {
          loadParent();
          if (onParentUpdated) onParentUpdated();
        }}
      />
    </>
  );
}

