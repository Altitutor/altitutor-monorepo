'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Alert, AlertDescription, AlertTitle } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Loader2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getExistingConversationForRelated, ensureConversationForContact } from '../api/queries';
import { ensureContactForStudent, ensureContactForParent, ensureContactForStaff } from '../utils/contactHelpers';
import { studentsApi } from '@/features/students/api/students';
import { staffApi, type StaffListItem } from '@/features/staff/api/staff';
import { parentsApi } from '@/features/parents/api/parents';
import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ViewStudentModal } from '@/features/students/components';

interface NewConversationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationSelected: (conversationId: string) => void;
}

type SearchResultItem = 
  | { type: 'student'; data: Tables<'students'> }
  | { type: 'staff'; data: StaffListItem }
  | { type: 'parent'; data: Tables<'parents'> };

export function NewConversationDialog({
  isOpen,
  onClose,
  onConversationSelected,
}: NewConversationDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNoPhoneWarning, setShowNoPhoneWarning] = useState(false);
  const [studentModalOpen, setStudentModalOpen] = useState(false);

  const trimmed = searchQuery.trim();
  const hasSearch = trimmed.length > 0;

  // Search students
  const { data: studentsData = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['new-conversation-student-search', trimmed],
    queryFn: async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
        p_search: hasSearch ? trimmed : undefined,
        p_statuses: undefined,
        p_include_relationships: false,
        p_limit: hasSearch ? 100 : 20,
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return [];

      const rpcData = rpcResult as { students: any[]; total: number };
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

  // Search staff
  const { data: staffData = [], isLoading: isLoadingStaff } = useQuery({
    queryKey: ['new-conversation-staff-search', trimmed],
    queryFn: async () => {
      const result = await staffApi.listMinimal({
        search: trimmed,
        limit: hasSearch ? 100 : 20,
        offset: 0,
        orderBy: 'last_name',
        ascending: true,
      });
      return result.staff;
    },
    enabled: isOpen,
    staleTime: 1000 * 30,
  });

  // Search parents using RPC
  const { data: parentsData = [], isLoading: isLoadingParents } = useQuery({
    queryKey: ['new-conversation-parent-search', trimmed],
    queryFn: async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_parents_admin', {
        p_search: hasSearch ? trimmed : undefined,
        p_include_relationships: false,
        p_limit: hasSearch ? 100 : 20,
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return [];

      const rpcData = rpcResult as { parents: any[]; total: number };
      // Transform RPC response to match Tables<'parents'> format
      return (rpcData.parents || []).map((p: any) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email || null,
        phone: p.phone || null,
        user_id: null,
        invite_token: null,
        created_by: null,
        created_at: p.created_at || null,
        updated_at: p.updated_at || null,
      })) as Tables<'parents'>[];
    },
    enabled: isOpen,
    staleTime: 1000 * 30,
  });

  // Combine all results
  const searchResults: SearchResultItem[] = useMemo(() => {
    const results: SearchResultItem[] = [];
    
    studentsData.forEach((student) => {
      results.push({ type: 'student', data: student });
    });
    
    staffData.forEach((staff) => {
      results.push({ type: 'staff', data: staff });
    });
    
    parentsData.forEach((parent) => {
      results.push({ type: 'parent', data: parent });
    });
    
    return results;
  }, [studentsData, staffData, parentsData]);

  const isSearching = isLoadingStudents || isLoadingStaff || isLoadingParents;

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedItem(null);
      setError(null);
      setShowNoPhoneWarning(false);
      setIsProcessing(false);
    }
  }, [isOpen]);

  const handleItemSelect = async (item: SearchResultItem) => {
    setSelectedItem(item);
    setError(null);
    setIsProcessing(true);

    try {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      let relatedId: string;
      let relatedType: 'student' | 'staff' | 'parent';
      let phone: string | null | undefined;

      if (item.type === 'student') {
        relatedId = item.data.id;
        relatedType = 'student';
        phone = item.data.phone;
      } else if (item.type === 'staff') {
        relatedId = item.data.id;
        relatedType = 'staff';
        phone = item.data.phone_number;
      } else {
        relatedId = item.data.id;
        relatedType = 'parent';
        phone = item.data.phone;
      }

      // Step 1: Check if conversation already exists
      const existingConversationId = await getExistingConversationForRelated(relatedId, relatedType);
      if (existingConversationId) {
        onConversationSelected(existingConversationId);
        onClose();
        return;
      }

      // Step 2: Check if contact exists and sync phone if needed
      const field = relatedType === 'student' ? 'student_id' : relatedType === 'staff' ? 'staff_id' : 'parent_id';
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id, phone_e164')
        .eq(field, relatedId)
        .maybeSingle();

      if (existingContact) {
        // Sync phone if it's different
        if (phone && existingContact.phone_e164 !== phone) {
          const { error: updateError } = await supabase
            .from('contacts')
            .update({ phone_e164: phone })
            .eq('id', existingContact.id);

          if (updateError) {
            throw new Error('Failed to sync contact phone number');
          }
        }

        // If contact exists but no phone, we can't create a conversation
        if (!phone && !existingContact.phone_e164) {
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

      // Step 3: No contact exists - check if has phone number
      if (!phone) {
        setShowNoPhoneWarning(true);
        setIsProcessing(false);
        return;
      }

      // Step 4: Create contact and conversation
      let contactId: string | null;
      if (item.type === 'student') {
        contactId = await ensureContactForStudent(relatedId);
      } else if (item.type === 'staff') {
        contactId = await ensureContactForStaff(relatedId);
      } else {
        contactId = await ensureContactForParent(relatedId);
      }

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
    if (selectedItem && selectedItem.type === 'student') {
      setStudentModalOpen(true);
      setShowNoPhoneWarning(false);
    }
  };

  const handleStudentModalClose = () => {
    setStudentModalOpen(false);
    if (selectedItem && selectedItem.type === 'student') {
      setSelectedItem(null);
      setIsProcessing(false);
    }
  };

  const getItemDisplayName = (item: SearchResultItem): string => {
    if (item.type === 'student') {
      return `${item.data.first_name} ${item.data.last_name}`;
    } else if (item.type === 'staff') {
      return `${item.data.first_name} ${item.data.last_name}`;
    } else {
      return `${item.data.first_name} ${item.data.last_name}`;
    }
  };

  const getItemContactInfo = (item: SearchResultItem): { phone?: string | null; email?: string | null } => {
    if (item.type === 'student') {
      return { phone: item.data.phone, email: item.data.email };
    } else if (item.type === 'staff') {
      return { phone: item.data.phone_number, email: item.data.email };
    } else {
      return { phone: item.data.phone, email: item.data.email };
    }
  };

  const getTypeBadgeVariant = (type: 'student' | 'staff' | 'parent'): 'default' | 'secondary' | 'outline' => {
    if (type === 'student') return 'default';
    if (type === 'staff') return 'secondary';
    return 'outline';
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>
              Search for a student, staff member, or parent to start a new conversation
            </DialogDescription>
          </DialogHeader>

          {showNoPhoneWarning && selectedItem ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Phone Number</AlertTitle>
                <AlertDescription>
                  This {selectedItem.type} doesn't have a phone number. Please add one to start a conversation.
                  {selectedItem.type === 'student' && ' You can update it in the student details.'}
                </AlertDescription>
              </Alert>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNoPhoneWarning(false)}>
                  Cancel
                </Button>
                {selectedItem.type === 'student' && (
                  <Button onClick={handleOpenStudentModal}>
                    Open Student Details
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Input
                  placeholder="Search students, staff, or parents..."
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
                    {trimmed.length > 0 ? 'No results found' : 'Start typing to search...'}
                  </div>
                ) : (
                  <div className="space-y-1 pr-4">
                    {searchResults.map((item) => {
                      const name = getItemDisplayName(item);
                      const contactInfo = getItemContactInfo(item);
                      const hasPhone = !!contactInfo.phone;
                      const hasEmail = !!contactInfo.email;

                      return (
                        <button
                          key={`${item.type}-${item.data.id}`}
                          type="button"
                          onClick={() => handleItemSelect(item)}
                          disabled={isProcessing}
                          className="w-full text-left p-3 hover:bg-accent rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium flex-1">{name}</div>
                            <Badge variant={getTypeBadgeVariant(item.type)} className="text-xs">
                              {item.type === 'student' ? 'Student' : item.type === 'staff' ? 'Staff' : 'Parent'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {hasPhone && <span>Phone: {contactInfo.phone}</span>}
                            {hasPhone && hasEmail && <span> • </span>}
                            {hasEmail && <span>Email: {contactInfo.email}</span>}
                            {!hasPhone && !hasEmail && (
                              <span className="text-destructive">No phone number</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
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

      {selectedItem && selectedItem.type === 'student' && (
        <ViewStudentModal
          isOpen={studentModalOpen}
          onClose={handleStudentModalClose}
          studentId={selectedItem.data.id}
          onStudentUpdated={() => {
            // After student is updated, try again
            handleStudentModalClose();
          }}
        />
      )}
    </>
  );
}
