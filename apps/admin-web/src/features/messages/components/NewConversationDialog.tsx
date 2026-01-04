'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Alert, AlertDescription, AlertTitle } from '@altitutor/ui';
import { Loader2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getExistingConversationForRelated, ensureConversationForContact } from '../api/queries';
import { ensureContactForStudent } from '../utils/contactHelpers';
import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ViewStudentModal } from '@/features/students/components';

interface NewConversationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationSelected: (conversationId: string) => void;
}

export function NewConversationDialog({
  isOpen,
  onClose,
  onConversationSelected,
}: NewConversationDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Tables<'students'> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNoPhoneWarning, setShowNoPhoneWarning] = useState(false);
  const [studentModalOpen, setStudentModalOpen] = useState(false);

  // Search students using RPC - show initial students when no search, search results when typing
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['new-conversation-student-search', searchQuery.trim()],
    queryFn: async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const trimmed = searchQuery.trim();
      
      // Use RPC directly to get phone/email fields
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
        p_search: trimmed.length > 0 ? trimmed : undefined,
        p_statuses: undefined, // Search all statuses
        p_include_relationships: false,
        p_limit: trimmed.length > 0 ? 1000 : 30, // Show first 30 when no search, more when searching
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return [];

      const rpcData = rpcResult as { students: any[]; total: number };
      // Transform RPC response to match Tables<'students'> format
      return (rpcData.students || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status,
        curriculum: s.curriculum || null,
        year_level: s.year_level || null,
        school: s.school || null,
        email: s.email || null,
        phone: s.phone || null,
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
      })) as Tables<'students'>[];
    },
    enabled: isOpen,
    staleTime: 1000 * 30,
  });

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedStudent(null);
      setError(null);
      setShowNoPhoneWarning(false);
      setIsProcessing(false);
    }
  }, [isOpen]);

  const handleStudentSelect = async (student: Tables<'students'>) => {
    setSelectedStudent(student);
    setError(null);
    setIsProcessing(true);

    try {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;

      // Step 1: Check if conversation already exists
      const existingConversationId = await getExistingConversationForRelated(student.id, 'student');
      if (existingConversationId) {
        onConversationSelected(existingConversationId);
        onClose();
        return;
      }

      // Step 2: Check if contact exists
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id, phone_e164')
        .eq('student_id', student.id)
        .maybeSingle();

      if (existingContact) {
        // Check if contact phone is synced to student phone
        // If student has phone but contact doesn't match, update it
        if (student.phone && existingContact.phone_e164 !== student.phone) {
          // Contact exists but phone is out of sync - update it
          const { error: updateError } = await supabase
            .from('contacts')
            .update({ phone_e164: student.phone })
            .eq('id', existingContact.id);

          if (updateError) {
            throw new Error('Failed to sync contact phone number');
          }
        }

        // If contact exists but student has no phone, we can't create a conversation
        if (!student.phone && !existingContact.phone_e164) {
          setShowNoPhoneWarning(true);
          setIsProcessing(false);
          return;
        }

        // Create conversation for existing contact
        const conversationId = await ensureConversationForContact(existingContact.id);
        onConversationSelected(conversationId);
        onClose();
        return;
      }

      // Step 3: No contact exists - check if student has phone number
      if (!student.phone) {
        // No phone number - show warning
        setShowNoPhoneWarning(true);
        setIsProcessing(false);
        return;
      }

      // Step 4: Create contact and conversation
      const contactId = await ensureContactForStudent(student.id);
      if (!contactId) {
        throw new Error('Failed to create contact');
      }

      const conversationId = await ensureConversationForContact(contactId);
      onConversationSelected(conversationId);
      onClose();
    } catch (err) {
      console.error('Error creating conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
      setIsProcessing(false);
    }
  };

  const handleOpenStudentModal = () => {
    if (selectedStudent) {
      setStudentModalOpen(true);
      setShowNoPhoneWarning(false);
    }
  };

  const handleStudentModalClose = () => {
    setStudentModalOpen(false);
    // Refresh student data if modal was closed after update
    if (selectedStudent) {
      // Reset to allow retry
      setSelectedStudent(null);
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>
              Search for a student to start a new conversation
            </DialogDescription>
          </DialogHeader>

          {showNoPhoneWarning && selectedStudent ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Phone Number</AlertTitle>
                <AlertDescription>
                  This student doesn't have a phone number. Please add one to start a conversation.
                </AlertDescription>
              </Alert>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNoPhoneWarning(false)}>
                  Cancel
                </Button>
                <Button onClick={handleOpenStudentModal}>
                  Open Student Details
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                  autoFocus
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[400px]">
                {isSearching ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    {searchQuery.trim().length > 0 ? 'No students found' : 'No students available'}
                  </div>
                ) : (
                  <div className="space-y-1 pr-4">
                    {searchResults.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleStudentSelect(student)}
                        disabled={isProcessing}
                        className="w-full text-left p-3 hover:bg-accent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="font-medium">
                          {student.first_name} {student.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {student.phone && <span>Phone: {student.phone}</span>}
                          {student.phone && student.email && <span> • </span>}
                          {student.email && <span>Email: {student.email}</span>}
                          {!student.phone && !student.email && (
                            <span className="text-destructive">No phone number</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {isProcessing && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Processing...</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedStudent && (
        <ViewStudentModal
          isOpen={studentModalOpen}
          onClose={handleStudentModalClose}
          studentId={selectedStudent.id}
          onStudentUpdated={() => {
            // After student is updated, try again
            handleStudentModalClose();
          }}
        />
      )}
    </>
  );
}
