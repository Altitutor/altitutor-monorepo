'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useMessagesForContact } from '../api/queries';
import { useMarkRead } from '../api/mutations';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatMessageDate, formatMessageStatus, formatDaySeparator, isDifferentDay } from '../utils/formatDate';
import { StaffAvatar } from './StaffAvatar';
import { Input } from '@altitutor/ui';
import { X } from 'lucide-react';
import { Button, Badge } from '@altitutor/ui';
import { messagesKeys } from '../api/queryKeys';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  contactId: string;
  isSearching?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (term: string) => void;
  onExitSearch?: () => void;
}

export function MessageThread({ contactId, isSearching = false, searchTerm = '', onSearchTermChange, onExitSearch }: Props) {
  const { data, fetchNextPage, hasNextPage } = useMessagesForContact(contactId);
  const markRead = useMarkRead();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevContactId = useRef(contactId);
  const lastMarkedMessageId = useRef<string | null>(null);
  const markReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Reset initial load flag when contact changes
  useEffect(() => {
    if (prevContactId.current !== contactId) {
      isInitialLoad.current = true;
      prevContactId.current = contactId;
      lastMarkedMessageId.current = null; // Reset when contact changes
      // Cancel any pending markRead calls
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = null;
      }
    }
  }, [contactId]);

  useEffect(() => {
    if (!contactId) return;
    
    // Get all conversation IDs for this contact to subscribe to all of them
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    // Fetch conversation IDs for this contact
    supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .in('status', ['OPEN', 'SNOOZED'])
      .then(({ data: conversations }) => {
        if (!conversations || conversations.length === 0) return;
        
        const conversationIds = conversations.map((c: any) => c.id);
        
        // Subscribe to messages from all conversations for this contact
        const channel = supabase
          .channel(`messages-contact-${contactId}`)
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `conversation_id=in.(${conversationIds.join(',')})`
          }, () => {
            // Invalidate to refetch all messages for this contact
            qc.invalidateQueries({ queryKey: messagesKeys.messagesForContact(contactId) });
          })
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'messages',
            filter: `conversation_id=in.(${conversationIds.join(',')})`
          }, () => {
            qc.invalidateQueries({ queryKey: messagesKeys.messagesForContact(contactId) });
          })
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'conversations',
            filter: `contact_id=eq.${contactId}`
          }, () => {
            qc.invalidateQueries({ queryKey: messagesKeys.messagesForContact(contactId) });
          })
          .subscribe();
        
        return () => {
          supabase.removeChannel(channel);
        };
      });
  }, [contactId, qc]);

  // Mark conversation as read - debounced and only when last message changes
  useEffect(() => {
    const last = data?.pages?.flatMap(p => p.items)?.[0];
    const lastMessageId = last?.id;
    const currentContactId = contactId; // Capture for closure
    
    // Only mark as read if:
    // 1. We have a last message ID
    // 2. It's different from what we last marked
    if (lastMessageId && lastMessageId !== lastMarkedMessageId.current) {
      // Cancel any pending markRead calls
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
      }
      
      // Debounce markRead to avoid excessive calls when switching contacts quickly
      markReadTimeoutRef.current = setTimeout(() => {
        // Double-check we're still on the same contact
        if (prevContactId.current === currentContactId) {
          markRead.mutate({ contactId: currentContactId, lastMessageId });
          lastMarkedMessageId.current = lastMessageId;
        }
        markReadTimeoutRef.current = null;
      }, 500); // 500ms debounce
    }
    
    // Cleanup timeout on unmount or contact change
    return () => {
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = null;
      }
    };
  }, [data, contactId, markRead]);

  // Auto-scroll to bottom on initial load and when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const shouldScroll = isInitialLoad.current || (el.scrollHeight - el.scrollTop - el.clientHeight) < 150;
      if (shouldScroll) {
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            isInitialLoad.current = false;
          }
        }, 0);
      }
    }
  }, [data]);

  const items = data?.pages?.flatMap(p => p.items) || [];

  // Filter and process messages for search
  const processedMessages = useMemo(() => {
    if (!isSearching || !searchTerm.trim()) {
      return items.slice().reverse();
    }
    
    const search = searchTerm.toLowerCase();
    const reversedItems = items.slice().reverse();
    const filtered: any[] = [];
    let hiddenCount = 0;
    
    reversedItems.forEach((m, index) => {
      const matches = m.body.toLowerCase().includes(search);
      
      if (matches) {
        // Add separator for hidden messages before this one
        if (hiddenCount > 0) {
          filtered.push({ type: 'separator', count: hiddenCount, id: `sep-${index}` });
          hiddenCount = 0;
        }
        filtered.push({ ...m, type: 'message', searchTerm });
      } else {
        hiddenCount++;
      }
    });
    
    // Add final separator if needed
    if (hiddenCount > 0) {
      filtered.push({ type: 'separator', count: hiddenCount, id: `sep-end` });
    }
    
    return filtered;
  }, [items, isSearching, searchTerm]);

  // Highlight search term in message body
  const highlightText = (text: string, term: string) => {
    if (!term) return text;
    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <span key={i} className="bg-yellow-200 dark:bg-yellow-600">{part}</span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Prevent scroll events from propagating to the page behind
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const isScrollable = scrollHeight > clientHeight;
      
      if (!isScrollable) {
        // If not scrollable, allow event to propagate to page
        return;
      }
      
      const isAtTop = scrollTop <= 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
      
      // Always stop propagation to prevent page scrolling
      e.stopPropagation();
      
      // Only prevent default when at boundaries to prevent overscroll
      if ((e.deltaY > 0 && isAtBottom) || (e.deltaY < 0 && isAtTop)) {
        e.preventDefault();
      }
    };

    scrollElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      scrollElement.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search bar */}
      {isSearching && (
        <div className="p-3 border-b dark:border-brand-dark-border flex items-center gap-2 flex-shrink-0 bg-background sticky top-0 z-10">
          <Input
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange?.(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button variant="ghost" size="icon" onClick={onExitSearch}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2 min-h-0">
        {hasNextPage && (
          <button className="text-xs text-blue-600 hover:underline mb-2" onClick={() => fetchNextPage()}>Load older messages</button>
        )}
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground">No messages yet.</div>
        ) : isSearching && processedMessages.length === 0 ? (
          <div className="text-xs text-muted-foreground">No messages found.</div>
        ) : (
          processedMessages
            .map((item, index, arr) => {
              if (item.type === 'separator') {
                return (
                  <div key={item.id} className="text-center text-xs text-muted-foreground my-2 py-1">
                    {item.count} message{item.count > 1 ? 's' : ''} hidden
                  </div>
                );
              }
              
              const m = item;
              const showDateSeparator = !isSearching && (index === 0 || (arr[index - 1]?.type === 'message' && isDifferentDay(m.created_at, arr[index - 1].created_at)));
              
              return (
                <div key={m.id}>
                  {showDateSeparator && (
                    <div className="text-center text-xs text-muted-foreground my-3">
                      {formatDaySeparator(m.created_at)}
                    </div>
                  )}
                  <div className={`flex gap-2 items-end ${m.direction === 'OUTBOUND' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Staff avatar for outbound messages */}
                    {m.direction === 'OUTBOUND' && m.staff && (
                      <StaffAvatar
                        staffId={m.staff.id}
                        firstName={m.staff.first_name}
                        lastName={m.staff.last_name}
                      />
                    )}
                    
                    <div className={`max-w-[80%] ${m.direction === 'OUTBOUND' ? 'text-right' : ''}`}>
                      {/* Sender badge for outbound messages */}
                      {m.direction === 'OUTBOUND' && m.sender && (
                        <div className={`mb-1 ${m.direction === 'OUTBOUND' ? 'flex justify-end' : 'flex justify-start'}`}>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            From: {m.sender.sender_type === 'ALPHANUMERIC' 
                              ? (m.sender.alphanumeric_sender_id || m.sender.label || 'Unknown')
                              : (m.sender.label || m.sender.phone_e164 || 'Unknown')}
                          </Badge>
                        </div>
                      )}
                      <div className={`inline-block px-3 py-2 rounded-md text-sm whitespace-pre-wrap ${m.direction === 'OUTBOUND' ? 'bg-brand-lightBlue text-brand-dark-bg' : 'bg-muted'}`}>
                        {isSearching && searchTerm ? highlightText(m.body, searchTerm) : m.body}
                      </div>
                      <div className={`text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5 ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                        <span>{formatMessageDate(m.created_at)}</span>
                        {m.direction === 'OUTBOUND' && m.status && (
                          <span className="text-[9px]">• {formatMessageStatus(m.status)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}


