'use client';

import { ConversationList } from '@/features/messages/components/ConversationList';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { ConversationHeader } from '@/features/messages/components/ConversationHeader';
import { Composer } from '@/features/messages/components/Composer';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAvailableSenders, useConversationsByContact } from '@/features/messages/api/queries';
import { useMarkRead, useMarkUnread } from '@/features/messages/api/mutations';
import { formatContactName } from '@/features/messages/utils/formatContactName';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { AddStudentModal } from '@/features/students/components/AddStudentModal';
import { AddParentModal } from '@/features/parents/components/AddParentModal';
import { AddStaffModal } from '@/features/staff/components/AddStaffModal';
import { useStudents, useUpdateStudent } from '@/features/students/hooks/useStudentsQuery';
import { useUpdateParent } from '@/features/parents/hooks/useParentsQuery';
import { useStaff, useUpdateStaff } from '@/features/staff/hooks/useStaffQuery';
import { useToast } from '@altitutor/ui';
import { messagesKeys } from '@/features/messages/api/queryKeys';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const conversationParam = searchParams.get('conversation'); // For backward compatibility
  const contactParam = searchParams.get('contact');
  const [activeContactId, setActiveContactId] = useState<string | null>(contactParam);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Per-conversation draft messages (keyed by contactId)
  const draftsRef = useRef<Map<string, string>>(new Map());
  const [currentDraft, setCurrentDraft] = useState<string>('');
  const currentDraftRef = useRef<string>(''); // Keep latest draft value for saving on switch
  
  // Modal states
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddParentOpen, setIsAddParentOpen] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [prefillPhoneForModal, setPrefillPhoneForModal] = useState<string | null>(null);
  const [isLinkingPhone, setIsLinkingPhone] = useState(false);
  const [selectedOwnedNumberId, setSelectedOwnedNumberId] = useState<string | null>(null);
  const { data: conversationsByContact } = useConversationsByContact(selectedOwnedNumberId);
  const { data: availableSenders = [] } = useAvailableSenders();
  const { data: students = [] } = useStudents();
  const { data: staff = [] } = useStaff();
  const { data: parentsWithoutPhone = [] } = useQuery({
    queryKey: ['parents', 'without-phone'],
    queryFn: async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('parents')
        .select('id, first_name, last_name, phone')
        .order('last_name', { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((parent) => !parent.phone?.trim());
    },
  });

  const updateStudent = useUpdateStudent();
  const updateParent = useUpdateParent();
  const updateStaff = useUpdateStaff();
  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  
  // Convert conversationId to contactId if provided (backward compatibility)
  useEffect(() => {
    if (conversationParam && !contactParam) {
      const supabase = getSupabaseClient();
      supabase
        .from('conversations')
        .select('contact_id')
        .eq('id', conversationParam)
        .maybeSingle<{ contact_id: string }>()
        .then(({ data }) => {
          if (data?.contact_id) {
            setActiveContactId(data.contact_id);
            // Update URL to use contact instead of conversation
            const params = new URLSearchParams(searchParams.toString());
            params.delete('conversation');
            params.set('contact', data.contact_id);
            router.replace(`/messages?${params.toString()}`);
          }
        });
    }
  }, [conversationParam, contactParam, searchParams, router]);
  
  // Fetch active contact details for header
  const { data: activeContact } = useQuery({
    queryKey: ['contact', activeContactId],
    queryFn: async () => {
      if (!activeContactId) return null;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          phone_e164,
          contact_type,
          students (id, first_name, last_name),
          parents (id, first_name, last_name, parents_students (students (id, first_name, last_name))),
          staff (id, first_name, last_name)
        `)
        .eq('id', activeContactId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeContactId,
  });
  
  // Sync from URL params
  useEffect(() => {
    const contactId = searchParams.get('contact');
    if (contactId) {
      setActiveContactId(contactId);
    } else if (!activeContactId && !conversationParam) {
      // Auto-select most recent contact when no URL param
      (async () => {
        // This will be handled by the hook, but we can select the first one
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('conversations')
          .select('contact_id')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle<{ contact_id: string }>();
        if (data?.contact_id) {
          setActiveContactId(data.contact_id);
          const params = new URLSearchParams(searchParams.toString());
          params.set('contact', data.contact_id);
          router.push(`/messages?${params.toString()}`);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  
  // Track previous contactId to save draft when switching
  const previousContactIdRef = useRef<string | null>(null);
  
  // Manage per-conversation drafts: save current draft when switching conversations
  useEffect(() => {
    // Save draft for previous conversation before switching (use ref to get latest value)
    if (previousContactIdRef.current && previousContactIdRef.current !== activeContactId) {
      draftsRef.current.set(previousContactIdRef.current, currentDraftRef.current);
    }
    
    // Restore draft for new conversation
    if (activeContactId) {
      const savedDraft = draftsRef.current.get(activeContactId) || '';
      setCurrentDraft(savedDraft);
      currentDraftRef.current = savedDraft;
    } else {
      setCurrentDraft('');
      currentDraftRef.current = '';
    }
    
    previousContactIdRef.current = activeContactId;
  }, [activeContactId]);
  
  // Handler to update draft for current conversation
  const handleDraftChange = (newDraft: string) => {
    setCurrentDraft(newDraft);
    currentDraftRef.current = newDraft;
    if (activeContactId) {
      draftsRef.current.set(activeContactId, newDraft);
    }
  };
  
  // Handler to clear draft after sending (called from Composer)
  const handleDraftClear = () => {
    setCurrentDraft('');
    currentDraftRef.current = '';
    if (activeContactId) {
      draftsRef.current.set(activeContactId, '');
    }
  };
  
  const conversationTitle = activeContact ? formatContactName({ contacts: activeContact }) : 'Messages';
  const activeAggregated = conversationsByContact?.find((c) => c.contactId === activeContactId) || null;
  const isActiveUnread = !!activeAggregated && activeAggregated.unreadCount > 0;

  const handleToggleReadHeader = () => {
    if (!activeContactId || !activeAggregated) return;
    if (isActiveUnread) {
      const lastMessageId = activeAggregated.latestMessage?.id;
      if (lastMessageId) {
        markRead.mutate({ contactId: activeContactId, lastMessageId });
      }
    } else {
      activeAggregated.conversations.forEach((conv) => {
        markUnread.mutate(conv.id);
      });
    }
  };
  
  const handleContactSelect = (contactId: string) => {
    setActiveContactId(contactId);
    setMobileView('thread');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('conversation'); // Remove old param
    params.set('contact', contactId);
    router.push(`/messages?${params.toString()}`);
  };
  
  const handleBack = () => {
    setMobileView('list');
  };

  const handleTitleClick = () => {
    if (!activeContact) return;
    
    const contact = activeContact;
    switch (contact.contact_type) {
      case 'STUDENT':
        if (contact.students?.id) {
          setSelectedStudentId(contact.students.id);
        }
        break;
      case 'STAFF':
        if (contact.staff?.id) {
          setSelectedStaffId(contact.staff.id);
        }
        break;
      case 'PARENT':
        if (contact.parents?.id) {
          setSelectedParentId(contact.parents.id);
        }
        break;
    }
  };

  const hasLinkedEntity =
    Boolean(activeContact?.students?.id) ||
    Boolean(activeContact?.parents?.id) ||
    Boolean(activeContact?.staff?.id);
  const showUnknownNumberActions = Boolean(activeContact?.phone_e164 && !hasLinkedEntity);

  const studentOptionsWithoutPhone = students
    .filter((student) => !student.phone?.trim())
    .map((student) => ({
      id: student.id,
      label: `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || 'Unnamed student',
    }));

  const parentOptionsWithoutPhone = parentsWithoutPhone.map((parent) => ({
    id: parent.id,
    label: `${parent.first_name ?? ''} ${parent.last_name ?? ''}`.trim() || 'Unnamed parent',
  }));

  const staffOptionsWithoutPhone = staff
    .filter((staffMember) => !staffMember.phone_number?.trim())
    .map((staffMember) => ({
      id: staffMember.id,
      label: `${staffMember.first_name ?? ''} ${staffMember.last_name ?? ''}`.trim() || 'Unnamed staff member',
    }));

  const handleOpenCreateStudent = () => {
    setPrefillPhoneForModal(activeContact?.phone_e164 ?? null);
    setIsAddStudentOpen(true);
  };

  const handleOpenCreateParent = () => {
    setPrefillPhoneForModal(activeContact?.phone_e164 ?? null);
    setIsAddParentOpen(true);
  };

  const handleOpenCreateStaff = () => {
    setPrefillPhoneForModal(activeContact?.phone_e164 ?? null);
    setIsAddStaffOpen(true);
  };

  const fromNumberOptions = availableSenders.map((sender) => ({
    id: sender.id,
    label:
      sender.sender_type === 'ALPHANUMERIC'
        ? (sender.alphanumeric_sender_id || sender.label || 'Unknown sender')
        : (sender.phone_e164 || sender.label || 'Unknown sender'),
  }));

  const selectedFromNumberOption = fromNumberOptions.find(
    (option) => option.id === selectedOwnedNumberId
  ) ?? null;

  const linkConversationContact = async (
    entityType: 'student' | 'parent' | 'staff',
    entityId: string
  ) => {
    if (!activeContactId || !activeContact?.phone_e164) return;

    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const updatePayload: {
      contact_type: 'STUDENT' | 'PARENT' | 'STAFF';
      student_id: string | null;
      parent_id: string | null;
      staff_id: string | null;
    } = {
      contact_type: entityType === 'student' ? 'STUDENT' : entityType === 'parent' ? 'PARENT' : 'STAFF',
      student_id: entityType === 'student' ? entityId : null,
      parent_id: entityType === 'parent' ? entityId : null,
      staff_id: entityType === 'staff' ? entityId : null,
    };

    const { error } = await supabase
      .from('contacts')
      .update(updatePayload)
      .eq('id', activeContactId);

    if (error) throw error;
  };

  const handleAssignNumberToExisting = async (
    entityType: 'student' | 'parent' | 'staff',
    entityId: string
  ) => {
    if (!activeContact?.phone_e164 || !activeContactId) return;
    const phoneNumber = activeContact.phone_e164;

    setIsLinkingPhone(true);
    try {
      if (entityType === 'student') {
        await updateStudent.mutateAsync({
          id: entityId,
          data: { phone: phoneNumber },
        });
      } else if (entityType === 'parent') {
        await updateParent.mutateAsync({
          id: entityId,
          data: { phone: phoneNumber },
        });
      } else {
        await updateStaff.mutateAsync({
          id: entityId,
          data: { phone_number: phoneNumber },
        });
      }

      await linkConversationContact(entityType, entityId);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contact', activeContactId] }),
        queryClient.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() }),
        queryClient.invalidateQueries({ queryKey: ['students', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['parents', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['staff', 'list'] }),
      ]);

      toast({
        title: 'Phone number linked',
        description: `Saved ${phoneNumber} to the selected ${entityType}.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to link phone number',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLinkingPhone(false);
    }
  };
  
  return (
    <div className="p-0 h-full overflow-hidden">
      <div className="flex h-full">
        {/* Conversation List 
            - Mobile (< md): Full width when viewing list, hidden when viewing thread
            - Medium (md-xl): Fixed width, always visible alongside messages
            - Wide (xl+): Fixed width, always visible with info panel
        */}
        <div className={`
          flex-shrink-0
          ${mobileView === 'thread' ? 'hidden md:block' : 'w-full md:w-[320px]'}
          md:w-[320px]
        `}>
          <ConversationList 
            activeContactId={activeContactId} 
            onSelect={handleContactSelect}
            selectedOwnedNumberId={selectedOwnedNumberId}
            onOwnedNumberFilterChange={setSelectedOwnedNumberId}
          />
        </div>
        
        {/* Messages 
            - Mobile (< md): Full width when viewing thread, hidden when viewing list
            - Medium (md+): Always visible, flex-1
        */}
        <div className={`
          flex-1 flex-col min-w-0
          ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
        `}>
          <ConversationHeader 
            title={conversationTitle}
            onSearchToggle={() => setIsSearching(!isSearching)}
            onTitleClick={activeContact ? handleTitleClick : undefined}
            onBack={handleBack}
            showBackButton={mobileView === 'thread'}
            isUnread={mobileView === 'thread' ? isActiveUnread : undefined}
            onToggleRead={mobileView === 'thread' ? handleToggleReadHeader : undefined}
            contact={activeContact}
            showUnknownNumberActions={showUnknownNumberActions}
            isLinkingPhone={isLinkingPhone}
            studentOptionsWithoutPhone={studentOptionsWithoutPhone}
            parentOptionsWithoutPhone={parentOptionsWithoutPhone}
            staffOptionsWithoutPhone={staffOptionsWithoutPhone}
            onCreateStudent={handleOpenCreateStudent}
            onCreateParent={handleOpenCreateParent}
            onCreateStaff={handleOpenCreateStaff}
            onAssignStudent={(studentId) => handleAssignNumberToExisting('student', studentId)}
            onAssignParent={(parentId) => handleAssignNumberToExisting('parent', parentId)}
            onAssignStaff={(staffId) => handleAssignNumberToExisting('staff', staffId)}
            fromNumberOptions={fromNumberOptions}
            selectedFromNumber={selectedFromNumberOption}
            onFromNumberChange={(option) => setSelectedOwnedNumberId(option?.id ?? null)}
          />
          <div className="flex-1 flex flex-col min-h-0">
            {activeContactId ? (
              <>
                <MessageThread 
                  contactId={activeContactId} 
                  ownedNumberId={selectedOwnedNumberId}
                  isSearching={isSearching}
                  searchTerm={searchTerm}
                  onSearchTermChange={setSearchTerm}
                  onExitSearch={() => setIsSearching(false)}
                />
                <Composer 
                  contactId={activeContactId} 
                  onTyping={() => setIsSearching(false)}
                  draft={currentDraft}
                  onDraftChange={handleDraftChange}
                  onDraftClear={handleDraftClear}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a conversation to start messaging
              </div>
            )}
          </div>
        </div>
        
      </div>
      
      {/* Modals */}
      {selectedStudentId && (
        <ViewStudentModal
          isOpen={!!selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          studentId={selectedStudentId}
          onStudentUpdated={() => {}}
        />
      )}
      
      {selectedStaffId && (
        <ViewStaffModal
          isOpen={!!selectedStaffId}
          onClose={() => setSelectedStaffId(null)}
          staffId={selectedStaffId}
          onStaffUpdated={() => {}}
        />
      )}
      
      {selectedParentId && (
        <ViewParentModal
          isOpen={!!selectedParentId}
          onClose={() => setSelectedParentId(null)}
          parentId={selectedParentId}
          onParentUpdated={() => {}}
        />
      )}

      <AddStudentModal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        onStudentAdded={() => {
          queryClient.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
          queryClient.invalidateQueries({ queryKey: ['contact', activeContactId] });
        }}
        initialPhone={prefillPhoneForModal}
      />

      <AddParentModal
        isOpen={isAddParentOpen}
        onClose={() => setIsAddParentOpen(false)}
        onParentAdded={() => {
          queryClient.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
          queryClient.invalidateQueries({ queryKey: ['contact', activeContactId] });
        }}
        initialPhone={prefillPhoneForModal}
      />

      <AddStaffModal
        isOpen={isAddStaffOpen}
        onClose={() => setIsAddStaffOpen(false)}
        onStaffAdded={() => {
          queryClient.invalidateQueries({ queryKey: messagesKeys.conversationsByContactBase() });
          queryClient.invalidateQueries({ queryKey: ['contact', activeContactId] });
        }}
        initialPhone={prefillPhoneForModal}
      />
    </div>
  );
}


