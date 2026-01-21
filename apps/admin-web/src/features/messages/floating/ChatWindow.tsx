'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Minus } from 'lucide-react';
import { useChatStore, ChatWindowDescriptor } from '../state/chatStore';
import { MessageThread } from '../components/MessageThread';
import { Composer } from '../components/Composer';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { formatContactName } from '../utils/formatContactName';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Props {
  descriptor: ChatWindowDescriptor;
}

export function ChatWindow({ descriptor }: Props) {
  const closeWindow = useChatStore(s => s.closeWindow);
  const minimizeWindow = useChatStore(s => s.minimizeWindow);
  const updateWindowTitle = useChatStore(s => s.updateWindowTitle);

  // Use ref to stabilize function reference and prevent unnecessary re-renders
  const updateWindowTitleRef = useRef(updateWindowTitle);

  // Update ref on every render to always have latest function
  useEffect(() => {
    updateWindowTitleRef.current = updateWindowTitle;
  });
  
  // Per-conversation draft messages (keyed by contactId) - separate from main page drafts
  const draftsRef = useRef<Map<string, string>>(new Map());
  const [currentDraft, setCurrentDraft] = useState<string>('');
  const currentDraftRef = useRef<string>('');
  const previousContactIdRef = useRef<string | null>(null);

  // Get contactId from conversationId
  const { data: contactId } = useQuery({
    queryKey: ['contact-from-conversation', descriptor.conversationId],
    queryFn: async () => {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const { data, error } = await supabase
        .from('conversations')
        .select('contact_id')
        .eq('id', descriptor.conversationId)
        .maybeSingle();
      if (error) throw error;
      return data?.contact_id || null;
    },
    enabled: !!descriptor.conversationId,
  });

  // Fetch contact details
  const { data: contact } = useQuery({
    queryKey: ['contact-header', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          phone_e164,
          contact_type,
          students (id, first_name, last_name),
          parents (id, first_name, last_name, parents_students (students (id, first_name, last_name))),
          staff (id, first_name, last_name)
        `)
        .eq('id', contactId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Update the window title when we have the contact name
  useEffect(() => {
    if (contact) {
      const contactName = formatContactName({ contacts: contact });
      updateWindowTitleRef.current(descriptor.conversationId, contactName);
    }
  }, [contact, descriptor.conversationId]);
  
  // Manage per-conversation drafts: save current draft when contactId changes
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
    
    previousContactIdRef.current = contactId ?? null;
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

  const displayTitle = contact ? formatContactName({ contacts: contact }) : (descriptor.title || 'Loading...');

  return (
    <div 
      className={`w-[calc(100vw-2rem)] max-w-[320px] shadow-lg rounded-md border bg-background dark:bg-brand-dark-card overflow-hidden ${descriptor.minimized ? 'h-auto' : ''}`}
      onClick={(e) => {
        // If minimized and clicked anywhere except buttons, expand it
        if (descriptor.minimized && !(e.target as HTMLElement).closest('button')) {
          minimizeWindow(descriptor.conversationId, false);
        }
      }}
    >
      <div className={`flex items-center justify-between px-3 py-2 ${descriptor.minimized ? 'border-b-0 cursor-pointer' : 'border-b dark:border-brand-dark-border'}`}>
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
      {!descriptor.minimized && contactId && (
        <div className="flex flex-col h-[380px] max-h-[calc(100vh-8rem)]">
          <MessageThread contactId={contactId} />
          <Composer 
            contactId={contactId}
            draft={currentDraft}
            onDraftChange={handleDraftChange}
            onDraftClear={handleDraftClear}
          />
        </div>
      )}
    </div>
  );
}


