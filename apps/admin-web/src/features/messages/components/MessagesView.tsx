'use client';
import { useAccessoryTitle } from '@/shared/hooks/useAccessoryTitle';
import { useRouter as useNextRouter } from 'next/navigation';

import { ConversationList } from '@/features/messages/components/ConversationList';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { ConversationHeader } from '@/features/messages/components/ConversationHeader';
import { Composer } from '@/features/messages/components/Composer';
import { useState, useEffect, type ReactNode } from 'react';
import { NoteAlertPills } from '@/shared/components/NoteAlertPills';
import { usePanelMediaQuery } from '@/shared/hooks/usePanelMediaQuery';
import { usePaneNavigation } from '@/shared/hooks/usePaneNavigation';
import { useAccessoryTab } from '@/shared/contexts/AccessoryTabContext';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useConversationList } from '@/features/messages/api/queries';
import {
  useMarkConversationRead,
  useMarkRead,
  useMarkUnread,
  useMarkContactUnread,
} from '@/features/messages/api/mutations';
import { formatContactName } from '@/features/messages/utils/formatContactName';
import { useUnknownNumberLinking } from '@/features/messages/hooks/useUnknownNumberLinking';
import { AccessoryBreadcrumb } from '@/shared/components/accessory-panel/AccessoryBreadcrumb';
import { EntityCommunicationPanel } from '@/features/activity/components/EntityCommunicationPanel';
import {
  linkedConversationEntity,
} from '@/features/activity/lib/entityCommunication';
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

export function MessagesView() {
  const { searchParams, router } = usePaneNavigation();
  const tabScope = useAccessoryTab();
  const conversationParam = searchParams.get('conversation'); // For backward compatibility
  const contactParam = searchParams.get('contact');
  const groupParam = searchParams.get('group');
  const [activeContactId, setActiveContactId] = useState<string | null>(contactParam);
  const [composeIntent, setComposeIntent] = useState<{ contactId: string; destinationAddress?: string; senderId?: string } | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(groupParam);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>(contactParam || groupParam ? 'thread' : 'list');
  const isDesktopSplitPane = usePanelMediaQuery('(min-width: 768px)');
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { ownedNumberFilter: selectedOwnedNumberId, setOwnedNumberFilter: setSelectedOwnedNumberId } =
    useMessagingListFilters(tabScope ? `tab:${tabScope.tab.key}` : 'page');
  const nextRouter = useNextRouter();
  const { draft: currentDraft, onDraftChange: handleDraftChange, onDraftClear: handleDraftClear } =
    usePersistedConversationDraft(
      getMessagingDraftKey(
        activeGroupId
          ? { kind: 'group', conversationId: activeGroupId }
          : { kind: 'contact', contactId: activeContactId }
      )
    );
  
  useEffect(() => {
    if (contactParam || groupParam) setMobileView('thread');
  }, [contactParam, groupParam]);

  const [composerSenderId, setComposerSenderId] = useState<string | null>(null);
  const { data: conversationsByContact } = useConversationList(selectedOwnedNumberId);
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
          phone_e164, email,
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
    } else if (
      !tabScope &&
      !activeContactId &&
      !activeGroupId &&
      !conversationParam
    ) {
      // Full /messages page: auto-select most recent contact when no URL param.
      // Accessory tabs stay on the conversation list until the user picks one.
      (async () => {
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
    } else if (!contactId && !groupId) {
      setActiveContactId(null);
      setActiveGroupId(null);
      setMobileView('list');
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

  useAccessoryTitle(activeSelection ? conversationTitle : 'Messages');
  const handleConversationSelect = (selection: ConversationSelection) => {
    setComposeIntent(selection.kind === 'contact' ? selection : null);
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

  const linkedEntity = linkedConversationEntity(activeContact);

  const handleTitleClick = () => {
    if (!linkedEntity) return;
    const route =
      linkedEntity.type === 'student'
        ? 'students'
        : linkedEntity.type === 'parent'
          ? 'parents'
          : 'staff';
    nextRouter.push(`/${route}/${linkedEntity.id}`);
  };

  const linking = useUnknownNumberLinking({
    contactId: activeContactId,
    contact: activeContact,
    onLinked: (contactId) => handleConversationSelect({
      kind: 'contact',
      contactId,
      destinationAddress: composeIntent?.contactId === activeContactId ? composeIntent.destinationAddress : undefined,
      senderId: composeIntent?.contactId === activeContactId ? composeIntent.senderId : undefined,
    }),
  });

  const renderConversationHeader = (filterControl?: ReactNode) => (
    <>
      <ConversationHeader
        filterControl={filterControl}
        compactActions
        paneHeader
        title={conversationTitle}
        titleSlot={
          tabScope ? (
            <AccessoryBreadcrumb onCurrentClick={linkedEntity ? handleTitleClick : undefined} />
          ) : undefined
        }
        onSearchToggle={() => setIsSearching(!isSearching)}
        onTitleClick={linkedEntity ? handleTitleClick : undefined}
        onBack={handleBack}
        showBackButton={
          !tabScope && !isDesktopSplitPane && mobileView === 'thread'
        }
        backButtonClassName="md:hidden"
        isUnread={activeSelection ? (activeGroup ? isActiveGroupUnread : isActiveUnread) : undefined}
        onToggleRead={activeSelection ? handleToggleReadHeader : undefined}
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
        extraMenuItems={
          activeGroup ? (
            <GroupConversationActions
              variant="menu"
              conversationId={activeGroup.conversationId}
              currentName={activeGroup.groupName}
            />
              ) : undefined
            }
          />
      {tabScope && linkedEntity ? (
        <NoteAlertPills
          entityType={linkedEntity.type}
          entityId={linkedEntity.id}
          className="shrink-0 border-b px-4 py-2"
        />
      ) : null}
    </>
  );

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
            filterScope={tabScope ? `tab:${tabScope.tab.key}` : "page"}
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
          {!tabScope || !linkedEntity || !activeContactId ? renderConversationHeader() : null}
          <div className="flex-1 flex flex-col min-h-0">
            {linkedEntity && activeContactId ? (
              <EntityCommunicationPanel
                key={`${linkedEntity.type}:${linkedEntity.id}:${activeContactId}`}
                entityType={linkedEntity.type}
                entityId={linkedEntity.id}
                initialContactId={activeContactId}
                initialDestinationAddress={composeIntent?.contactId === activeContactId ? composeIntent.destinationAddress : undefined}
                initialSenderId={composeIntent?.contactId === activeContactId ? composeIntent.senderId : undefined}
                defaultShowActivity={false}
                renderHeader={tabScope ? renderConversationHeader : undefined}
                isSearching={isSearching}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                onExitSearch={() => setIsSearching(false)}
              />
            ) : activeContactId || activeGroup ? (
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
                  initialDestinationAddress={composeIntent?.contactId === activeContactId ? composeIntent.destinationAddress : undefined}
                  conversationId={activeGroup?.conversationId}
                  groupChatId={activeGroup?.groupChatId}
                  initialSenderId={activeGroup?.ownedNumberId ?? (composeIntent?.contactId === activeContactId ? composeIntent.senderId : undefined)}
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

      {linking.linkingModals}
    </div>
  );
}




