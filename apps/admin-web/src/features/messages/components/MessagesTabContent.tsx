'use client';

import { useState, useEffect, useRef } from 'react';
import { Button as UIButton } from '@altitutor/ui';
import { MessageThread } from './MessageThread';
import { Composer } from './Composer';
import { useChatStore } from '../state/chatStore';
import { getContactIdByRelatedId, getConversationIdForContact } from '../api/queries';
import { useContactIdFromConversation } from '../hooks/useContactQueries';

interface MessagesTabContentProps {
  conversationId: string | null; // For backward compatibility, will be converted to contactId
  title: string;
  onClose: () => void;
  // For creating conversation on first message
  relatedId?: string;
  relatedType?: 'student' | 'staff' | 'parent';
}

export function MessagesTabContent({ 
  conversationId: initialConversationId, 
  title,
  onClose,
  relatedId,
  relatedType
}: MessagesTabContentProps) {
  const [contactId, setContactId] = useState<string | null>(null);
  
  // Per-conversation draft messages (keyed by contactId)
  const draftsRef = useRef<Map<string, string>>(new Map());
  const [currentDraft, setCurrentDraft] = useState<string>('');
  const currentDraftRef = useRef<string>(''); // Keep latest draft value for saving on switch
  const previousContactIdRef = useRef<string | null>(null);

  // Convert conversationId to contactId if provided (for backward compatibility)
  const { data: contactIdFromConversation } = useContactIdFromConversation(
    initialConversationId && !relatedId ? initialConversationId : undefined
  );

  useEffect(() => {
    if (contactIdFromConversation) {
      setContactId(contactIdFromConversation);
    } else if (relatedId && relatedType) {
      // Get contactId from relatedId
      getContactIdByRelatedId(relatedId, relatedType).then((cid) => {
        setContactId(cid);
      });
    }
  }, [contactIdFromConversation, relatedId, relatedType]);
  
  // Manage per-conversation drafts: save current draft when switching conversations
  useEffect(() => {
    // Save draft for previous conversation before switching (use ref to get latest value)
    if (previousContactIdRef.current && previousContactIdRef.current !== contactId) {
      draftsRef.current.set(previousContactIdRef.current, currentDraftRef.current);
    }
    
    // Restore draft for new conversation
    if (contactId) {
      const savedDraft = draftsRef.current.get(contactId) || '';
      setCurrentDraft(savedDraft);
      currentDraftRef.current = savedDraft;
    } else {
      setCurrentDraft('');
      currentDraftRef.current = '';
    }
    
    previousContactIdRef.current = contactId;
  }, [contactId]);
  
  // Handler to update draft for current conversation
  const handleDraftChange = (newDraft: string) => {
    setCurrentDraft(newDraft);
    currentDraftRef.current = newDraft;
    if (contactId) {
      draftsRef.current.set(contactId, newDraft);
    }
  };
  
  // Handler to clear draft after sending (called from Composer)
  const handleDraftClear = () => {
    setCurrentDraft('');
    currentDraftRef.current = '';
    if (contactId) {
      draftsRef.current.set(contactId, '');
    }
  };

  const handleFirstMessage = async (_messageBody: string, _selectedSenderId: string) => {
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
              const conversationId = await getConversationIdForContact(contactId);
              if (conversationId) {
                useChatStore.getState().openWindow({ conversationId, title });
                onClose();
              }
            }
          }}
          disabled={!contactId}
        >
          Pop out
        </UIButton>
      </div>
      
      {/* Scrollable Message Thread */}
      {contactId ? (
        <>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <MessageThread contactId={contactId} />
          </div>
          {/* Fixed Footer with Composer */}
          <div className="flex-shrink-0 border-t bg-background">
            <Composer 
              contactId={contactId} 
              onBeforeSend={handleFirstMessage}
              draft={currentDraft}
              onDraftChange={handleDraftChange}
              onDraftClear={handleDraftClear}
            />
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

