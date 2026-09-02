'use client';

import { ConversationList } from '@/features/messages/components/ConversationList';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { ConversationHeader } from '@/features/messages/components/ConversationHeader';
import { Composer } from '@/features/messages/components/Composer';
import { useState, useEffect } from 'react';
import { useMediaQuery } from '@altitutor/ui';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAvailableSenders, useConversationList } from '@/features/messages/api/queries';
import {
  useMarkConversationRead,
  useMarkRead,
  useMarkUnread,
  useMarkContactUnread,
} from '@/features/messages/api/mutations';
import { formatContactName } from '@/features/messages/utils/formatContactName';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { useUnknownNumberLinking } from '@/features/messages/hooks/useUnknownNumberLinking';
import {
  isContactConversation,
  isGroupConversation,
  type ConversationListItem,
  type ConversationSelection,
} from '@/features/messages/types';
import { GroupConversationActions } from '@/features/messages/imessage/GroupConversationActions';
import {
  getMessagingDraftKey,
  useMessagingListFilters,
  usePersistedConversationDraft,
} from '@/features/messages/state/messagingUiStore';

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationParam = searchParams.get('conversation'); // For backward compatibility
  const contactParam = searchParams.get('contact');
  const groupParam = searchParams.get('group');
  const [activeContactId, setActiveContactId] = useState<string | null>(contactParam);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(groupParam);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const isDesktopSplitPane = useMediaQuery('(min-width: 768px)');
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { ownedNumberFilter: selectedOwnedNumberId, setOwnedNumberFilter: setSelectedOwnedNumberId } =
    useMessagingListFilters('page');
  const { draft: currentDraft, onDraftChange: handleDraftChange, onDraftClear: handleDraftClear } =
    usePersistedConversationDraft(
      getMessagingDraftKey(
        activeGroupId
          ? { kind: 'group', conversationId: activeGroupId }
          : { kind: 'contact', contactId: activeContactId }
      )
    );
  
  // Modal states
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [composerSenderId, setComposerSenderId] = useState<string | null>(null);
  const { data: conversationsByContact } = useConversationList(selectedOwnedNumberId);
  const { data: availableSenders = [] } = useAvailableSenders();
  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const markContactUnread = useMarkContactUnread();
  const markConversationRead = useMarkConversationRead();

  useEffect(() => {
    setComposerSenderId(null);
  }, [activeContactId]);
  
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
          staff (id, first_name, last_name, role)
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
    const groupId = searchParams.get('group');
    if (contactId) {
      setActiveContactId(contactId);
      setActiveGroupId(null);
    } else if (groupId) {
      setActiveGroupId(groupId);
      setActiveContactId(null);
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
  
  const activeAggregated = conversationsByContact?.find(
    (c): c is Extract<ConversationListItem, { kind: 'contact' }> =>
      isContactConversation(c) && c.contactId === activeContactId
  );
  const activeGroup = conversationsByContact?.find(
    (c): c is Extract<ConversationListItem, { kind: 'group' }> =>
      isGroupConversation(c) && c.conversationId === activeGroupId
  );
  const conversationTitle = activeGroup
    ? activeGroup.groupName || 'Group chat'
    : activeContact
      ? formatContactName({ contacts: activeContact })
      : 'Messages';
  const isActiveUnread = !!activeAggregated && activeAggregated.unreadCount > 0;
  const isActiveGroupUnread = !!activeGroup && activeGroup.unreadCount > 0;

  const handleToggleReadHeader = () => {
    if (activeGroup) {
      if (isActiveGroupUnread && activeGroup.latestMessage?.id) {
        markConversationRead.mutate({
          conversationId: activeGroup.conversationId,
          lastMessageId: activeGroup.latestMessage.id,
        });
      } else {
        markUnread.mutate(activeGroup.conversationId);
      }
      return;
    }
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
  
  const activeSelection: ConversationSelection | null = activeGroupId
    ? { kind: 'group', conversationId: activeGroupId }
    : activeContactId
      ? { kind: 'contact', contactId: activeContactId }
      : null;

  const handleConversationSelect = (selection: ConversationSelection) => {
    setMobileView('thread');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('conversation');
    params.delete('contact');
    params.delete('group');
    if (selection.kind === 'contact') {
      setActiveContactId(selection.contactId);
      setActiveGroupId(null);
      params.set('contact', selection.contactId);
    } else {
      setActiveGroupId(selection.conversationId);
      setActiveContactId(null);
      params.set('group', selection.conversationId);
    }
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

  const linking = useUnknownNumberLinking({
    contactId: activeContactId,
    contact: activeContact,
  });

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
            filterScope="page"
            activeSelection={activeSelection}
            onSelect={handleConversationSelect}
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
            showBackButton={!isDesktopSplitPane && mobileView === 'thread'}
            backButtonClassName="md:hidden"
            isUnread={mobileView === 'thread' ? (activeGroup ? isActiveGroupUnread : isActiveUnread) : undefined}
            onToggleRead={mobileView === 'thread' ? handleToggleReadHeader : undefined}
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
            onFromNumberChange={(option) => setSelectedOwnedNumberId(option?.id ?? null)}
            extraActions={
              activeGroup ? (
                <GroupConversationActions
                  conversationId={activeGroup.conversationId}
                  currentName={activeGroup.groupName}
                />
              ) : undefined
            }
          />
          <div className="flex-1 flex flex-col min-h-0">
            {activeContactId || activeGroup ? (
              <>
                <MessageThread 
                  contactId={activeContactId} 
                  conversationId={activeGroup?.conversationId}
                  ownedNumberId={selectedOwnedNumberId}
                  isSearching={isSearching}
                  searchTerm={searchTerm}
                  onSearchTermChange={setSearchTerm}
                  onExitSearch={() => setIsSearching(false)}
                  onResentViaSms={(smsOwnedNumberId) => {
                    setSelectedOwnedNumberId(null);
                    setComposerSenderId(smsOwnedNumberId);
                  }}
                />
                <Composer 
                  contactId={activeContactId} 
                  conversationId={activeGroup?.conversationId}
                  groupChatId={activeGroup?.groupChatId}
                  initialSenderId={activeGroup?.ownedNumberId}
                  preferredSenderId={composerSenderId}
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

      {linking.linkingModals}
    </div>
  );
}


