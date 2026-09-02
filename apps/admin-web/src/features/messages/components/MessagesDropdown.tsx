'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { MessageCircle } from 'lucide-react';
import { ConversationList } from './ConversationList';
import { ConversationHeader } from './ConversationHeader';
import { MessageThread } from './MessageThread';
import { Composer } from './Composer';
import { formatContactName } from '../utils/formatContactName';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useMessageSubscription } from '../hooks/useMessageSubscription';
import { useConversationsByContact, useUnreadConversationCount, getContactIdFromConversation, useAvailableSenders } from '../api/queries';
import { useMarkRead, useMarkContactUnread } from '../api/mutations';
import { useChatStore } from '../state/chatStore';
import {
  getMessagingDraftKey,
  useMessagingListFilters,
  useMessagingUiHydration,
  useMessagingUiStore,
  usePersistedConversationDraft,
} from '../state/messagingUiStore';
import { cn } from '@/shared/utils';
import type { ConversationSelection } from '../types';
import { useUnknownNumberLinking } from '../hooks/useUnknownNumberLinking';

export function MessagesDropdown() {
  useMessagingUiHydration();
  const [isOpen, setIsOpen] = useState(false);
  const view = useMessagingUiStore((s) => s.dropdownView);
  const setView = useMessagingUiStore((s) => s.setDropdownView);
  const dropdownSelection = useMessagingUiStore((s) => s.dropdownSelection);
  const setDropdownSelection = useMessagingUiStore((s) => s.setDropdownSelection);
  const { ownedNumberFilter, setOwnedNumberFilter } = useMessagingListFilters('dropdown');
  const activeContactId = dropdownSelection?.kind === 'contact' ? dropdownSelection.contactId : null;

  // When another part of the app (e.g. reconciliation Message button) calls openWindow(conversationId),
  // open this dropdown and show that conversation
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const { data: contactIdFromStore } = useQuery({
    queryKey: ['contactIdFromConversation', activeConversationId],
    queryFn: () => getContactIdFromConversation(activeConversationId!),
    enabled: !!activeConversationId,
  });
  useEffect(() => {
    if (activeConversationId && contactIdFromStore) {
      setIsOpen(true);
      setDropdownSelection({ kind: 'contact', contactId: contactIdFromStore });
      setView('thread');
      setActiveConversation(null); // consume intent so we don't re-open on next render
    }
  }, [activeConversationId, contactIdFromStore, setActiveConversation, setDropdownSelection, setView]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { draft: currentDraft, onDraftChange: handleDraftChange, onDraftClear: handleDraftClear } =
    usePersistedConversationDraft(getMessagingDraftKey(dropdownSelection));
  
  // Modal states
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  
  // Subscribe to new messages
  useMessageSubscription();
  
  // Lightweight badge count — do not load the full inbox on every page
  const { data: unreadCount = 0 } = useUnreadConversationCount();
  // Full contact aggregation only when the panel is open (thread header / mark read)
  const needsConversationDetails = isOpen && (view === 'thread' || !!activeContactId);
  const { data: conversations } = useConversationsByContact(ownedNumberFilter, {
    enabled: needsConversationDetails,
  });
  const { data: availableSenders = [] } = useAvailableSenders();
  const markRead = useMarkRead();
  const markContactUnread = useMarkContactUnread();
  
  const activeAggregated = useMemo(
    () => conversations?.find((c) => c.contactId === activeContactId) || null,
    [conversations, activeContactId]
  );
  const isActiveUnread = !!activeAggregated && activeAggregated.unreadCount > 0;

  const handleToggleReadHeader = () => {
    if (!activeContactId || !activeAggregated) return;
    if (isActiveUnread) {
      const lastMessageId = activeAggregated.latestMessage?.id;
      if (lastMessageId) {
        markRead.mutate({ contactId: activeContactId, lastMessageId });
      }
    } else {
      markContactUnread.mutate(activeContactId);
    }
  };
  
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
  
  const conversationTitle = activeContact ? formatContactName({ contacts: activeContact }) : 'Messages';
  const linking = useUnknownNumberLinking({
    contactId: activeContactId,
    contact: activeContact,
    enabled: isOpen && view === 'thread',
  });
  const fromNumberOptions = availableSenders.map((sender) => ({
    id: sender.id,
    label:
      sender.sender_type === 'ALPHANUMERIC'
        ? (sender.alphanumeric_sender_id || sender.label || 'Unknown sender')
        : (sender.phone_e164 || sender.label || 'Unknown sender'),
  }));
  const selectedFromNumberOption = fromNumberOptions.find(
    (option) => option.id === ownedNumberFilter
  ) ?? null;
  
  const handleBack = () => {
    setView('list');
    setIsSearching(false);
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
  
  const handleConversationClick = (contactId: string) => {
    setDropdownSelection({ kind: 'contact', contactId });
    setView('thread');
  };
  
  useEffect(() => {
    if (!isOpen) {
      setIsSearching(false);
    }
  }, [isOpen]);
  
  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9 relative"
            aria-label={`Messages${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          >
            <MessageCircle className="h-4 w-4" />
            {unreadCount > 0 && (
              <span 
                className={cn(
                  "absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold z-10",
                  unreadCount > 9 && "text-[9px]"
                )}
              >
                {unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          align="end" 
          className="w-[420px] max-w-[calc(100vw-2rem)] h-[calc(100dvh-120px)] max-h-[700px] p-0 flex flex-col"
          collisionPadding={16}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex h-full overflow-hidden flex-col">
            {/* Conversation List - shown when view is 'list' */}
            {view === 'list' && (
              <div className="w-full h-full flex-shrink-0">
                <ConversationList 
                  filterScope="dropdown"
                  activeSelection={dropdownSelection}
                  onSelect={(selection: ConversationSelection) => {
                    if (selection.kind === 'contact') {
                      handleConversationClick(selection.contactId);
                    } else {
                      window.location.assign(`/messages?group=${selection.conversationId}`);
                    }
                  }}
                />
              </div>
            )}
            
            {/* Conversation View - shown when view is 'thread' */}
            {view === 'thread' && (
              <div className="w-full h-full flex flex-col min-w-0">
                <ConversationHeader 
                  title={conversationTitle}
                  compactActions
                  onSearchToggle={() => setIsSearching(!isSearching)}
                  onTitleClick={activeContact ? handleTitleClick : undefined}
                  onBack={handleBack}
                  showBackButton={true}
                  isUnread={isActiveUnread}
                  onToggleRead={handleToggleReadHeader}
                  contact={activeContact}
                  showUnknownNumberActions={linking.showUnknownNumberActions}
                  isLinkingPhone={linking.isLinkingPhone}
                  studentOptionsWithoutPhone={linking.studentOptionsWithoutPhone}
                  parentOptionsWithoutPhone={linking.parentOptionsWithoutPhone}
                  staffOptionsWithoutPhone={linking.staffOptionsWithoutPhone}
                  onCreateStudent={linking.onCreateStudent}
                  onCreateParent={linking.onCreateParent}
                  onCreateStaff={linking.onCreateStaff}
                  onAssignStudent={linking.onAssignStudent}
                  onAssignParent={linking.onAssignParent}
                  onAssignStaff={linking.onAssignStaff}
                  fromNumberOptions={fromNumberOptions}
                  selectedFromNumber={selectedFromNumberOption}
                  onFromNumberChange={(option) => setOwnedNumberFilter(option?.id ?? null)}
                />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {activeContactId ? (
                    <>
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <MessageThread 
                          contactId={activeContactId} 
                          ownedNumberId={ownedNumberFilter}
                          isSearching={isSearching}
                          searchTerm={searchTerm}
                          onSearchTermChange={setSearchTerm}
                          onExitSearch={() => setIsSearching(false)}
                        />
                      </div>
                      <div className="flex-shrink-0 border-t">
                        <Composer 
                          contactId={activeContactId} 
                          onTyping={() => setIsSearching(false)}
                          draft={currentDraft}
                          onDraftChange={handleDraftChange}
                          onDraftClear={handleDraftClear}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Select a conversation to start messaging
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      
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
      {linking.linkingModals}
    </>
  );
}
