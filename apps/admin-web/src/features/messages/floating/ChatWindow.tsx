'use client';

import { useEffect } from 'react';
import { X, Minus } from 'lucide-react';
import { useChatStore, ChatWindowDescriptor } from '../state/chatStore';
import { MessageThread } from '../components/MessageThread';
import { Composer } from '../components/Composer';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { formatContactName } from '../utils/formatContactName';

interface Props {
  descriptor: ChatWindowDescriptor;
}

export function ChatWindow({ descriptor }: Props) {
  const closeWindow = useChatStore(s => s.closeWindow);
  const minimizeWindow = useChatStore(s => s.minimizeWindow);
  const updateWindowTitle = useChatStore(s => s.updateWindowTitle);

  // Fetch conversation to get contact details
  const { data: conversation } = useQuery({
    queryKey: ['conversation-header', descriptor.conversationId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          contacts (
            id,
            display_name,
            phone_e164,
            contact_type,
            students (id, first_name, last_name),
            parents (id, first_name, last_name, parents_students (students (id, first_name, last_name))),
            staff (id, first_name, last_name)
          )
        `)
        .eq('id', descriptor.conversationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Update the window title when we have the contact name
  useEffect(() => {
    if (conversation) {
      const contactName = formatContactName(conversation);
      updateWindowTitle(descriptor.conversationId, contactName);
    }
  }, [conversation, descriptor.conversationId, updateWindowTitle]);

  const displayTitle = conversation ? formatContactName(conversation) : (descriptor.title || 'Loading...');

  return (
    <div 
      className="w-[320px] shadow-lg rounded-md border bg-background dark:bg-brand-dark-card overflow-hidden"
      onClick={(e) => {
        // If minimized and clicked anywhere except buttons, expand it
        if (descriptor.minimized && !(e.target as HTMLElement).closest('button')) {
          minimizeWindow(descriptor.conversationId, false);
        }
      }}
    >
      <div className={`flex items-center justify-between px-3 py-2 border-b dark:border-brand-dark-border ${descriptor.minimized ? 'cursor-pointer' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate max-w-[180px]">{displayTitle}</span>
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
            onClick={(e) => {
              e.stopPropagation();
              minimizeWindow(descriptor.conversationId, !descriptor.minimized);
            }}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            aria-label="Close"
            className="hover:opacity-80"
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(descriptor.conversationId);
            }}
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


