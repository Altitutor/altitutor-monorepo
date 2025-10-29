'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { Separator } from "@altitutor/ui";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { Tables } from '@altitutor/shared';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { ViewStudentModal } from './ViewStudentModal';

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
  const [parent, setParent] = useState<any | null>(null);
  const [students, setStudents] = useState<Tables<'students'>[]>([]);
  const [loadingParent, setLoadingParent] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);

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
      
      // Get conversation ID for messages tab
      const convId = await ensureConversationForRelated(parentId, 'parent');
      console.log('[ViewParentModal] Conversation ID for parent', parentId, ':', convId);
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
    }
  }, [isOpen]);

  const handleStudentClick = (studentId: string) => {
    setSelectedStudentId(studentId);
    setStudentModalOpen(true);
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
          <SheetHeader className="flex-shrink-0 px-6 pt-6 pb-4">
            <SheetTitle>
              Parent Details
            </SheetTitle>
            <SheetDescription className="text-lg font-medium">
              {parent.first_name} {parent.last_name}
            </SheetDescription>
          </SheetHeader>
          
          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              {/* Parent Contact Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="text-sm font-medium">Email:</div>
                  <div>{parent.email || '-'}</div>
                  
                  <div className="text-sm font-medium">Phone:</div>
                  <div>{parent.phone || '-'}</div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Students Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Students</h3>
                {students.length > 0 ? (
                  <div className="grid gap-4">
                    {students.map((student) => (
                      <Card 
                        key={student.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleStudentClick(student.id)}
                      >
                        <CardHeader>
                          <CardTitle className="text-lg">
                            {student.first_name} {student.last_name}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No students associated with this parent</p>
                )}
              </div>

              <Separator className="my-6" />

              {/* Messages Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Messages</h3>
                <div className="border rounded-md" style={{ height: '500px' }}>
                  <MessagesTabContent
                    conversationId={conversationId}
                    title={`${parent.first_name} ${parent.last_name}`}
                    onClose={onClose}
                  />
                </div>
              </div>
            </div>
          </div>
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

