'use client';

import { X, Minus } from 'lucide-react';
import { useChatStore, ChatWindowDescriptor } from '../state/chatStore';
import { MessageThread } from '../components/MessageThread';
import { Composer } from '../components/Composer';

interface Props {
  descriptor: ChatWindowDescriptor;
}

export function ChatWindow({ descriptor }: Props) {
  const closeWindow = useChatStore(s => s.closeWindow);
  const minimizeWindow = useChatStore(s => s.minimizeWindow);

  return (
    <div className="w-[320px] shadow-lg rounded-md border bg-background dark:bg-brand-dark-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b dark:border-brand-dark-border">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate max-w-[180px]">{descriptor.title || 'Conversation'}</span>
          {descriptor.unreadCount > 0 && (
            <span className="text-xs bg-brand-lightBlue text-brand-dark-bg rounded-full px-2 py-0.5">
              {descriptor.unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Minimize"
            className="hover:opacity-80"
            onClick={() => minimizeWindow(descriptor.conversationId, !descriptor.minimized)}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            aria-label="Close"
            className="hover:opacity-80"
            onClick={() => closeWindow(descriptor.conversationId)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {!descriptor.minimized && (
        <div className="flex flex-col h-[380px]">
          <MessageThread conversationId={descriptor.conversationId} />
          <Composer conversationId={descriptor.conversationId} />
        </div>
      )}
    </div>
  );
}


