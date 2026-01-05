'use client';

import { useState, useEffect } from 'react';
import { Button as UIButton } from '@altitutor/ui';
import { MessageThread } from './MessageThread';
import { Composer } from './Composer';
import { useChatStore } from '../state/chatStore';
import { getContactIdByRelatedId } from '../api/queries';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

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

  // Convert conversationId to contactId if provided (for backward compatibility)
  useEffect(() => {
    if (initialConversationId && !relatedId) {
      // If we have a conversationId but no relatedId, fetch the contactId from conversation
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      supabase
        .from('conversations')
        .select('contact_id')
        .eq('id', initialConversationId)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data?.contact_id) {
            setContactId(data.contact_id);
          }
        });
    } else if (relatedId && relatedType) {
      // Get contactId from relatedId
      getContactIdByRelatedId(relatedId, relatedType).then((cid) => {
        setContactId(cid);
      });
    }
  }, [initialConversationId, relatedId, relatedType]);

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
          onClick={() => {
            if (contactId) {
              // For pop out, we still need a conversationId - use the first/default one
              const supabase = getSupabaseClient() as SupabaseClient<Database>;
              supabase
                .from('conversations')
                .select('id')
                .eq('contact_id', contactId)
                .in('status', ['OPEN', 'SNOOZED'])
                .limit(1)
                .maybeSingle()
                .then(({ data }: any) => {
                  if (data?.id) {
                    useChatStore.getState().openWindow({ conversationId: data.id, title });
                    onClose();
                  }
                });
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
          <div className="flex-1 min-h-0 overflow-y-auto">
            <MessageThread contactId={contactId} />
          </div>
          {/* Fixed Footer with Composer */}
          <div className="flex-shrink-0 border-t bg-background">
            <Composer contactId={contactId} onBeforeSend={handleFirstMessage} />
          </div>
        </>
      ) : relatedId && relatedType ? (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center text-muted-foreground text-sm">
            No messages yet. Send a message to start a conversation.
          </div>
          {/* Fixed Footer with Composer */}
          <div className="flex-shrink-0 border-t bg-background">
            <Composer contactId={null} onBeforeSend={handleFirstMessage} />
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

