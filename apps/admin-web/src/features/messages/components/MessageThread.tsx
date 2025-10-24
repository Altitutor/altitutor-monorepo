'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useMessages } from '../api/queries';
import { useMarkRead } from '../api/mutations';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatMessageDate, formatMessageStatus, formatDaySeparator, isDifferentDay } from '../utils/formatDate';
import { StaffAvatar } from './StaffAvatar';
import { Input } from '@altitutor/ui';
import { X } from 'lucide-react';
import { Button } from '@altitutor/ui';

interface Props {
  conversationId: string;
  isSearching?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (term: string) => void;
  onExitSearch?: () => void;
}

export function MessageThread({ conversationId, isSearching = false, searchTerm = '', onSearchTermChange, onExitSearch }: Props) {
  const { data, fetchNextPage, hasNextPage } = useMessages(conversationId);
  const markRead = useMarkRead();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const prevConversationId = useRef(conversationId);
  
  // Reset initial load flag when conversation changes
  useEffect(() => {
    if (prevConversationId.current !== conversationId) {
      isInitialLoad.current = true;
      prevConversationId.current = conversationId;
    }
  }, [conversationId]);

  useEffect(() => {
    // realtime subscription for this conversation's messages
    const supabase = getSupabaseClient();
    // Debug: mark subscription lifecycle
    console.debug('[MessageThread] subscribe', { conversationId });
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload: any) => {
        console.debug('[MessageThread] messages INSERT', { newId: (payload as any)?.new?.id });
        // Patch cache with new message for instant rendering
        qc.setQueryData(['messages', conversationId], (old: any) => {
          if (!old?.pages) return old;
          const newItem = (payload as any).new;
          const pages = [...old.pages];
          if (pages[0]) {
            pages[0] = { ...pages[0], items: [newItem, ...pages[0].items] };
          }
          return { ...old, pages };
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload: any) => {
        console.debug('[MessageThread] messages UPDATE', { id: (payload as any)?.new?.id, status: (payload as any)?.new?.status });
        // Patch cache with updated message
        qc.setQueryData(['messages', conversationId], (old: any) => {
          if (!old?.pages) return old;
          const updatedItem = (payload as any).new;
          const pages = old.pages.map((page: any) => ({
            ...page,
            items: page.items.map((m: any) => m.id === updatedItem.id ? { ...m, ...updatedItem } : m)
          }));
          return { ...old, pages };
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` }, (payload: any) => {
        console.debug('[MessageThread] conversations update', { eventType: (payload as any)?.eventType, id: (payload as any)?.new?.id });
        qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      })
      .subscribe((status: string, err: any) => {
        console.debug('[MessageThread] subscription status', { conversationId, status, err: err?.message || null });
      });
    return () => {
      console.debug('[MessageThread] unsubscribe', { conversationId });
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  useEffect(() => {
    const last = data?.pages?.flatMap(p => p.items)?.[0];
    if (last?.id) {
      markRead.mutate({ conversationId, lastMessageId: last.id });
    }
  }, [data, conversationId]);

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search bar */}
      {isSearching && (
        <div className="p-3 border-b dark:border-brand-dark-border flex items-center gap-2">
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
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
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


