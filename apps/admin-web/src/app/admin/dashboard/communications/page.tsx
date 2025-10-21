'use client';

import { ConversationList } from '@/features/messages/components/ConversationList';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { ConversationHeader } from '@/features/messages/components/ConversationHeader';
import { Composer } from '@/features/messages/components/Composer';
import { useState } from 'react';

export default function CommunicationsPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  return (
    <div className="p-0 h-full">
      <div className="flex h-[calc(100vh-var(--navbar-height))]">
        <div className="w-[340px] flex-shrink-0">
          <ConversationList />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <ConversationHeader title="Messages" />
          <div className="flex-1 flex flex-col min-h-0">
            {activeConversationId ? (
              <>
                <MessageThread conversationId={activeConversationId} />
                <Composer conversationId={activeConversationId} />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a conversation to start messaging
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


