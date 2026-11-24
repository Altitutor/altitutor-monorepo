'use client';
import { Mail, MailOpen, UserRound } from 'lucide-react';
import { useRegisterRecordActions } from '@/features/command-palette/RecordActionsContext';
import { useAccessoryTitle } from '@/shared/hooks/useAccessoryTitle';
import { useRouter as useNextRouter } from 'next/navigation';

import { ConversationList } from '@/features/messages/components/ConversationList';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { ConversationHeader } from '@/features/messages/components/ConversationHeader';
import { Composer } from '@/features/messages/components/Composer';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Breadcrumb } from '@/shared/components/Breadcrumb';
import { ListSettingsMenu } from '@/shared/components/ListSettingsMenu';
import { NoteAlertPills } from '@/shared/components/NoteAlertPills';
import { usePanelMediaQuery } from '@/shared/hooks/usePanelMediaQuery';
import { usePaneNavigation } from '@/shared/hooks/usePaneNavigation';
import { useAccessoryTab } from '@/shared/contexts/AccessoryTabContext';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useActiveAdminStaff, useConversationList } from '@/features/messages/api/queries';
import {
  useAssignConversations,
  useMarkConversationRead,
  useMarkRead,
  useMarkUnread,
  useMarkContactUnread,
} from '@/features/messages/api/mutations';
import { formatContactName } from '@/features/messages/utils/formatContactName';
import { useUnknownNumberLinking } from '@/features/messages/hooks/useUnknownNumberLinking';
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
  const targetMessageId = searchParams.get("message");
  const conversationParam = searchParams.get('conversation'); // For backward compatibility
  const contactParam = searchParams.get('contact');
  const groupParam = searchParams.get('group');
  const [activeContactId, setActiveContactId] = useState<string | null>(contactParam);
  const [composeIntent, setComposeIntent] = useState<{ contactId: string; destinationAddress?: string; senderId?: string } | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(groupParam);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>(contactParam || groupParam || conversationParam ? 'thread' : 'list');
  const isDesktopSplitPane = usePanelMediaQuery('(min-width: 768px)');
  const [isSearching, setIsSearching] = useState(false);
  const [filterTarget, setFilterTarget] = useState<HTMLDivElement | null>(null);
  const [composeTarget, setComposeTarget] = useState<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { ownedNumberFilter: selectedOwnedNumberId, setOwnedNumberFilter: setSelectedOwnedNumberId } =
    useMessagingListFilters(tabScope ? `tab:${tabScope.tab.key}` : "page");
  const nextRouter = useNextRouter();
  const {
    draft: currentDraft,
    onDraftChange: handleDraftChange,
    onDraftClear: handleDraftClear,
  } = usePersistedConversationDraft(
    getMessagingDraftKey(
      activeGroupId
        ? { kind: "group", conversationId: activeGroupId }
        : { kind: "contact", contactId: activeContactId },
    ),
  );

  const [composerSenderId, setComposerSenderId] = useState<string | null>(null);
  const { data: conversationsByContact } = useConversationList(
    selectedOwnedNumberId,
  );
  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const markContactUnread = useMarkContactUnread();
  const markConversationRead = useMarkConversationRead();
  const assignConversation = useAssignConversations();
  const { data: adminStaff = [] } = useActiveAdminStaff();

  useEffect(() => {
    setComposerSenderId(null);
  }, [activeContactId]);

  // Convert conversationId to contactId if provided (backward compatibility)
  useEffect(() => {
    if (conversationParam && !contactParam && !groupParam) {
      let current = true;
      const supabase = getSupabaseClient();
      supabase
        .from("conversations")
        .select("contact_id,is_group_chat")
        .eq("id", conversationParam)
        .maybeSingle<{ contact_id: string | null; is_group_chat: boolean }>()
        .then(({ data }) => {
          if (!current) return;
          if (data?.is_group_chat) {
            setActiveGroupId(conversationParam);
            setActiveContactId(null);
            return;
          }
          if (data?.contact_id) {
            setActiveContactId(data.contact_id);
            setActiveGroupId(null);
            if (targetMessageId) return;
            // Update URL to use contact instead of conversation
            const params = new URLSearchParams(searchParams.toString());
            params.delete("conversation");
            params.set("contact", data.contact_id);
            router.replace(`/messages?${params.toString()}`);
          }
        });
      return () => {
        current = false;
      };
    }
  }, [conversationParam, contactParam, groupParam, searchParams, router, targetMessageId]);

  // Fetch active contact details for header
  const { data: activeContact } = useQuery({
    queryKey: ["contact", activeContactId],
    queryFn: async () => {
      if (!activeContactId) return null;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("contacts")
        .select(
          `
          id,
          phone_e164, email,
          contact_type,
          students (id, first_name, last_name),
          parents (id, first_name, last_name, parents_students (students (id, first_name, last_name))),
          staff (id, first_name, last_name, role)
        `,
        )
        .eq("id", activeContactId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeContactId,
  });

  useEffect(() => {
    if (contactParam) {
      setActiveContactId(contactParam);
      setActiveGroupId(null);
    } else if (groupParam) {
      setActiveGroupId(groupParam);
      setActiveContactId(null);
    } else if (!conversationParam) {
      setActiveContactId(null);
      setActiveGroupId(null);
    }
    setMobileView(contactParam || groupParam || conversationParam ? "thread" : "list");
  }, [contactParam, groupParam, conversationParam]);

  const activeAggregated = conversationsByContact?.find(
    (c): c is Extract<ConversationListItem, { kind: "contact" }> =>
      isContactConversation(c) && c.contactId === activeContactId,
  );
  const listedGroup = conversationsByContact?.find(
    (c): c is Extract<ConversationListItem, { kind: "group" }> =>
      isGroupConversation(c) && c.conversationId === activeGroupId,
  );
  // A referenced group can be closed, older than the inbox window or hidden by
  // its sender filter. Its identity must not depend on membership in that list.
  const { data: groupDetails } = useQuery({
    queryKey: ["messages", "group-details", activeGroupId],
    enabled: !!activeGroupId && !listedGroup,
    queryFn: async ({ signal }) => {
      const { data, error } = await getSupabaseClient()
        .from("conversations")
        .select("id,group_chat_id,group_chat_name,owned_number_id")
        .eq("id", activeGroupId!)
        .eq("is_group_chat", true)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw error;
      return data?.group_chat_id ? {
        conversationId: data.id,
        groupChatId: data.group_chat_id,
        groupName: data.group_chat_name,
        ownedNumberId: data.owned_number_id,
      } : null;
    },
  });
  const activeGroup = listedGroup ?? groupDetails;
  const conversationTitle = activeGroup
    ? activeGroup.groupName || "Group chat"
    : activeContact
      ? formatContactName({ contacts: activeContact })
      : "Messages";
  const isActiveUnread = !!activeAggregated && activeAggregated.unreadCount > 0;
  const isActiveGroupUnread = !!listedGroup && listedGroup.unreadCount > 0;

  const handleToggleReadHeader = () => {
    if (activeGroupId) {
      if (!listedGroup) return;
      if (isActiveGroupUnread && listedGroup.latestMessage?.id) {
        markConversationRead.mutate({
          conversationId: listedGroup.conversationId,
          lastMessageId: listedGroup.latestMessage.id,
        });
      } else {
        markUnread.mutate(listedGroup.conversationId);
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
    ? { kind: "group", conversationId: activeGroupId }
    : activeContactId
      ? { kind: "contact", contactId: activeContactId }
      : null;

  const { data: referenceTarget } = useQuery({
    queryKey: ['messages', 'reference-action-target', targetMessageId],
    enabled: Boolean(targetMessageId),
    queryFn: async () => {
      const db = getSupabaseClient();
      const { data: message, error } = await db.from('messages').select('conversation_id').eq('id', targetMessageId!).maybeSingle();
      if (error) throw error;
      if (!message) return null;
      const latest = await db.from('messages').select('id').eq('conversation_id', message.conversation_id).order('created_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      if (latest.error) throw latest.error;
      return { conversationId: message.conversation_id, lastMessageId: latest.data?.id };
    },
  });
  const referenceConversationIds = referenceTarget ? [referenceTarget.conversationId] : [];
  useRegisterRecordActions('message', targetMessageId ?? undefined, conversationTitle, [
    { id: 'mark-read', title: 'Mark as read', icon: MailOpen, action: () => { if (referenceTarget?.lastMessageId) markConversationRead.mutate({ conversationId: referenceTarget.conversationId, lastMessageId: referenceTarget.lastMessageId }); } },
    { id: 'mark-unread', title: 'Mark as unread', icon: Mail, action: () => { if (referenceTarget) markUnread.mutate(referenceTarget.conversationId); } },
    { id: 'unassign', title: 'Unassign conversation', icon: UserRound, disabled: assignConversation.isPending, action: () => assignConversation.mutate({ conversationIds: referenceConversationIds, staffId: null }) },
    ...adminStaff.map(person => ({ id: `assign-${person.id}`, title: `Assign to ${person.first_name} ${person.last_name}`, icon: UserRound, disabled: assignConversation.isPending, action: () => assignConversation.mutate({ conversationIds: referenceConversationIds, staffId: person.id }) })),
  ], { active: Boolean(referenceTarget), runOnly: true });

  useAccessoryTitle(activeSelection ? conversationTitle : "Messages");
  const handleConversationSelect = (selection: ConversationSelection) => {
    setComposeIntent(selection.kind === "contact" ? selection : null);
    setMobileView("thread");
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["contact", "conversation", "group", "message", "focus"]) {
      params.delete(key);
    }
    if (selection.kind === "contact") {
      setActiveContactId(selection.contactId);
      setActiveGroupId(null);
      params.set("contact", selection.contactId);
    } else {
      setActiveGroupId(selection.conversationId);
      setActiveContactId(null);
      params.set("group", selection.conversationId);
    }
    router.push(`/messages?${params.toString()}`);
  };

  const handleBack = () => {
    setIsSearching(false);
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["contact", "conversation", "group", "message", "focus"]) {
      params.delete(key);
    }
    router.push(params.size ? `/messages?${params}` : "/messages");
  };

  const linkedEntity = linkedConversationEntity(activeContact);

  const handleTitleClick = () => {
    if (!linkedEntity) return;
    const route =
      linkedEntity.type === "student"
        ? "students"
        : linkedEntity.type === "parent"
          ? "parents"
          : "staff";
    nextRouter.push(`/${route}/${linkedEntity.id}`);
  };

  const linking = useUnknownNumberLinking({
    contactId: activeContactId,
    contact: activeContact,
    onLinked: (contactId) =>
      handleConversationSelect({
        kind: "contact",
        contactId,
        destinationAddress:
          composeIntent?.contactId === activeContactId
            ? composeIntent.destinationAddress
            : undefined,
        senderId:
          composeIntent?.contactId === activeContactId
            ? composeIntent.senderId
            : undefined,
      }),
  });

  const showConversation = Boolean(activeSelection) &&
    (Boolean(tabScope) || isDesktopSplitPane || mobileView === "thread");

  const conversationHeader = (
    <>
      <ConversationHeader
        showConversationActions={showConversation}
        filterControl={<div ref={setFilterTarget} className="empty:hidden" />}
        extraActions={<>
          {!showConversation && <ListSettingsMenu list="messages" inline />}
          <div ref={setComposeTarget} className="empty:hidden" />
        </>}
        compactActions
        paneHeader
        title={conversationTitle}
        titleSlot={
          <Breadcrumb
            primary
            className="m-0 min-w-0 gap-1.5"
            items={showConversation ? [
              { label: "Messages", onClick: handleBack },
              { label: conversationTitle, onClick: linkedEntity ? handleTitleClick : undefined, entity: linkedEntity ?? undefined },
            ] : [{ label: "Messages" }]}
          />
        }
        onSearchToggle={() => setIsSearching(!isSearching)}
        onTitleClick={linkedEntity ? handleTitleClick : undefined}
        isUnread={
          activeSelection && (!activeGroupId || listedGroup)
            ? activeGroup
              ? isActiveGroupUnread
              : isActiveUnread
            : undefined
        }
        onToggleRead={activeSelection && (!activeGroupId || listedGroup) ? handleToggleReadHeader : undefined}
        messageId={(listedGroup ?? activeAggregated)?.latestMessage?.id ?? null}
        assigneeId={(listedGroup ?? activeAggregated)?.assignedStaffId ?? null}
        staffOptions={adminStaff}
        onAssign={(staffId) => {
          const conversationIds = (listedGroup ?? activeAggregated)?.conversationIds ?? [];
          if (conversationIds.length) assignConversation.mutate({ conversationIds, staffId });
        }}
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {conversationHeader}
      <div className="flex min-h-0 flex-1">
        <div
          className={`shrink-0 ${tabScope ? "hidden" : isDesktopSplitPane ? "w-80" : mobileView === "thread" ? "hidden" : "w-full"}`}
        >
          <ConversationList
            filterScope={tabScope ? `tab:${tabScope.tab.key}` : "page"}
            composeTarget={composeTarget}
            activeSelection={activeSelection}
            onSelect={handleConversationSelect}
          />
        </div>
        <div
          className={`
          flex-1 flex-col min-w-0
          ${!tabScope && !isDesktopSplitPane && mobileView === 'list' ? 'hidden' : 'flex'}
        `}
        >
          <div className="flex-1 flex flex-col min-h-0">
            {linkedEntity && activeContactId && !targetMessageId ? (
              <EntityCommunicationPanel
                key={`${linkedEntity.type}:${linkedEntity.id}:${activeContactId}`}
                entityType={linkedEntity.type}
                entityId={linkedEntity.id}
                initialContactId={activeContactId}
                initialDestinationAddress={
                  composeIntent?.contactId === activeContactId
                    ? composeIntent.destinationAddress
                    : undefined
                }
                initialSenderId={
                  composeIntent?.contactId === activeContactId
                    ? composeIntent.senderId
                    : undefined
                }
                hideHistoryToolbar
                renderHeader={(filter) => showConversation && filterTarget
                  ? createPortal(filter, filterTarget)
                  : null
                }
                isSearching={isSearching}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                onExitSearch={() => setIsSearching(false)}
              />
            ) : activeContactId || activeGroup ? (
              <>
                <MessageThread
                  activityMessageType={tabScope ? (activeGroup ? "group" : linkedEntity?.type ?? "other") : undefined}
                  referenceFocus={searchParams.get("focus")}
                  targetMessageId={targetMessageId}
                  contactId={activeContactId}
                  conversationId={
                    targetMessageId
                      ? conversationParam
                      : activeGroup?.conversationId
                  }
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
                  initialDestinationAddress={
                    composeIntent?.contactId === activeContactId
                      ? composeIntent.destinationAddress
                      : undefined
                  }
                  conversationId={activeGroup?.conversationId}
                  groupChatId={activeGroup?.groupChatId}
                  initialSenderId={
                    activeGroup?.ownedNumberId ??
                    (composeIntent?.contactId === activeContactId
                      ? composeIntent.senderId
                      : undefined)
                  }
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
