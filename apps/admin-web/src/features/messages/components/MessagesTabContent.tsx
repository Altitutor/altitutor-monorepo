"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMessageContactsForStudent } from "../api/queries";
import { Button as UIButton } from "@altitutor/ui";
import { MessageThread } from "./MessageThread";
import { Composer } from "./Composer";
import { useChatStore } from "../state/chatStore";
import {
  getContactIdByRelatedId,
  getConversationIdForContact,
} from "../api/queries";
import { useContactIdFromConversation } from "../hooks/useContactQueries";
import {
  getMessagingDraftKey,
  usePersistedConversationDraft,
} from "../state/messagingUiStore";

interface MessagesTabContentProps {
  conversationId: string | null; // For backward compatibility, will be converted to contactId
  title: string;
  onClose: () => void;
  // For creating conversation on first message
  relatedId?: string;
  relatedType?: "student" | "staff" | "parent";
}

export function MessagesTabContent({
  conversationId: initialConversationId,
  title,
  onClose,
  relatedId,
  relatedType,
}: MessagesTabContentProps) {
  const [defaultContactId, setContactId] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  );
  const historicalContacts = useQuery({
    queryKey: ["student-message-contacts", relatedId],
    queryFn: () => getMessageContactsForStudent(relatedId!),
    enabled: relatedType === "student" && Boolean(relatedId),
  });
  const selectedContact = historicalContacts.data?.find(
    (contact) => contact.id === selectedHistoryId,
  );
  const contactId =
    relatedType === "student" && relatedId
      ? (selectedContact?.id ??
        historicalContacts.data?.find((contact) => contact.is_current)?.id ??
        null)
      : defaultContactId;
  const viewingHistory = Boolean(
    selectedContact && !selectedContact.is_current,
  );
  const {
    draft: currentDraft,
    onDraftChange: handleDraftChange,
    onDraftClear: handleDraftClear,
  } = usePersistedConversationDraft(
    getMessagingDraftKey({ kind: "contact", contactId }) ??
      (relatedId && relatedType ? `related:${relatedType}:${relatedId}` : null),
  );

  // Convert conversationId to contactId if provided (for backward compatibility)
  const { data: contactIdFromConversation } = useContactIdFromConversation(
    initialConversationId && !relatedId ? initialConversationId : undefined,
  );

  useEffect(() => {
    if (contactIdFromConversation) {
      setContactId(contactIdFromConversation);
    } else if (relatedId && relatedType && relatedType !== "student") {
      // Get contactId from relatedId
      getContactIdByRelatedId(relatedId, relatedType).then((cid) => {
        setContactId(cid);
      });
    }
  }, [contactIdFromConversation, relatedId, relatedType]);

  const handleFirstMessage = async (
    _messageBody: string,
    _selectedSenderId: string,
  ) => {
    // ContactId should already be set from useEffect
    // This is just for backward compatibility
    return contactId;
  };

  return (
    <div className="flex flex-col h-full min-h-0 border rounded-md overflow-hidden">
      {/* Fixed Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0 bg-background">
        <div className="font-medium text-sm">Messages</div>
        <UIButton
          size="sm"
          onClick={async () => {
            if (contactId) {
              // For pop out, we still need a conversationId - use the first/default one
              const conversationId =
                await getConversationIdForContact(contactId);
              if (conversationId) {
                useChatStore.getState().openWindow({ conversationId, title });
                onClose();
              }
            }
          }}
          disabled={!contactId || viewingHistory}
        >
          Pop out
        </UIButton>
      </div>

      {historicalContacts.data &&
        historicalContacts.data.some((contact) => !contact.is_current) && (
          <label className="px-3 py-2 border-b text-sm">
            Conversation number
            <select
              aria-label="Conversation number"
              className="ml-2 rounded border bg-background p-1"
              value={contactId ?? ""}
              onChange={(event) => setSelectedHistoryId(event.target.value)}
            >
              <option value="">Choose a number</option>
              {historicalContacts.data.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.phone_e164}
                  {contact.is_current ? " (current)" : " (historical)"}
                </option>
              ))}
            </select>
          </label>
        )}
      {historicalContacts.error && (
        <p role="alert" className="p-3 text-sm text-destructive">
          Could not load conversation history.
        </p>
      )}
      {/* Scrollable Message Thread */}
      {contactId ? (
        <>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <MessageThread contactId={contactId} />
          </div>
          {/* Fixed Footer with Composer */}
          <div className="flex-shrink-0 border-t bg-background">
            {viewingHistory ? (
              <p className="p-3 text-sm text-muted-foreground">
                Historical conversation. Select the current number to send new
                messages.
              </p>
            ) : (
              <Composer
                contactId={contactId}
                onBeforeSend={handleFirstMessage}
                draft={currentDraft}
                onDraftChange={handleDraftChange}
                onDraftClear={handleDraftClear}
              />
            )}
          </div>
        </>
      ) : relatedId && relatedType ? (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center text-muted-foreground text-sm">
            No messages yet. Send a message to start a conversation.
          </div>
          {/* Fixed Footer with Composer */}
          <div className="flex-shrink-0 border-t bg-background">
            <Composer
              contactId={null}
              onBeforeSend={handleFirstMessage}
              draft={currentDraft}
              onDraftChange={handleDraftChange}
              onDraftClear={handleDraftClear}
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          No conversation available
        </div>
      )}
    </div>
  );
}
