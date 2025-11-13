'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MessagesTabContent } from '@/features/messages/components/MessagesTabContent';
import { getExistingConversationForRelated } from '@/features/messages/api/queries';
import { ViewStudentModal } from './ViewStudentModal';
import { ParentDetailsTab } from './tabs/ParentDetailsTab';

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
      setParent(data);
      
      // Extract students from the join
      const studentsList = data?.parents_students?.map((ps: any) => ps.students).filter(Boolean) || [];
      setStudents(studentsList);
      
      // Get existing conversation ID for messages tab (don't create new one)
      const convId = await getExistingConversationForRelated(parentId, 'parent');
      console.log('[ViewParentModal] Existing conversation ID for parent', parentId, ':', convId);
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
          {!parent ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-muted-foreground">
                {loadingParent ? 'Loading...' : ''}
              </div>
            </div>
          ) : (
            <>
              <SheetHeader className="flex-shrink-0 px-6 pt-6 pb-4">
                <SheetTitle>
                  Parent Details
                </SheetTitle>
                <SheetDescription className="text-lg font-medium">
                  {parent.first_name} {parent.last_name}
                </SheetDescription>
              </SheetHeader>
          
              <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
                <Tabs defaultValue="details" className="flex flex-col h-full min-h-0">
                  <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="messages">Messages</TabsTrigger>
                  </TabsList>
                
                  <div className="flex-1 min-h-0 overflow-hidden mt-4">
                    <TabsContent value="details" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                      <ParentDetailsTab
                        parent={parent}
                        studentIds={students.map(s => s.id)}
                        students={students}
                        onViewStudent={handleStudentClick}
                      />
                    </TabsContent>

                    <TabsContent value="messages" className="h-full min-h-0 overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                      <MessagesTabContent 
                        conversationId={conversationId}
                        title={`${parent.first_name} ${parent.last_name}`}
                        onClose={onClose}
                        relatedId={parentId || undefined}
                        relatedType="parent"
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </>
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

