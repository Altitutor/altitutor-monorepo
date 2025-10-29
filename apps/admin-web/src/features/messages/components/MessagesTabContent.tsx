'use client';

import { Button as UIButton } from '@altitutor/ui';
import { MessageThread } from './MessageThread';
import { Composer } from './Composer';
import { useChatStore } from '../state/chatStore';

interface MessagesTabContentProps {
  conversationId: string | null;
  title: string;
  onClose: () => void;
}

export function MessagesTabContent({ 
  conversationId, 
  title,
  onClose
}: MessagesTabContentProps) {
  return (
    <div className="flex flex-col h-full border rounded-md">
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
          <div className="flex-1 min-h-0 overflow-hidden">
            <MessageThread conversationId={conversationId} />
          </div>
          <div className="flex-shrink-0">
            <Composer conversationId={conversationId} />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          No conversation found
        </div>
      )}
    </div>
  );
}

