'use client';

import { useState } from 'react';
import { Button as UIButton } from '@altitutor/ui';
import { MessageThread } from './MessageThread';
import { Composer } from './Composer';
import { useChatStore } from '../state/chatStore';
import { ensureConversationForRelated } from '../api/queries';

interface MessagesTabContentProps {
  conversationId: string | null;
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
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);

  const handleFirstMessage = async (messageBody: string) => {
    // Create conversation on first send
    if (!conversationId && relatedId && relatedType) {
      const newConvId = await ensureConversationForRelated(relatedId, relatedType);
      if (newConvId) {
        setConversationId(newConvId);
        return newConvId;
      }
    }
    return conversationId;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 border rounded-md">
      <div className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0">
        <div className="font-medium text-sm">Messages</div>
        <UIButton
          size="sm"
          onClick={() => {
            if (conversationId) {
              useChatStore.getState().openWindow({ conversationId, title });
              onClose();
            }
          }}
          disabled={!conversationId}
        >
          Pop out
        </UIButton>
      </div>
      {conversationId ? (
        <>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <MessageThread conversationId={conversationId} />
          </div>
          <div className="flex-shrink-0">
            <Composer conversationId={conversationId} />
          </div>
        </>
      ) : relatedId && relatedType ? (
        <>
          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center text-muted-foreground text-sm">
            No messages yet. Send a message to start a conversation.
          </div>
          <div className="flex-shrink-0">
            <Composer conversationId={null} onBeforeSend={handleFirstMessage} />
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

