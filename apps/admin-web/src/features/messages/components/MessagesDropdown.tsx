'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { MessageCircle } from 'lucide-react';
import { ConversationList } from './ConversationList';
import { ConversationHeader } from './ConversationHeader';
import { MessageThread } from './MessageThread';
import { Composer } from './Composer';
import { formatContactName } from '../utils/formatContactName';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useMessageSubscription } from '../hooks/useMessageSubscription';
import { useConversationsByContact, getContactIdFromConversation } from '../api/queries';
import { useMarkRead, useMarkUnread } from '../api/mutations';
import { useChatStore } from '../state/chatStore';
import { cn } from '@/shared/utils';

export function MessagesDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'list' | 'thread'>('list');
  const [activeContactId, setActiveContactId] = useState<string | null>(null);

  // When another part of the app (e.g. reconciliation Message button) calls openWindow(conversationId),
  // open this dropdown and show that conversation
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const { data: contactIdFromStore } = useQuery({
    queryKey: ['contactIdFromConversation', activeConversationId],
    queryFn: () => getContactIdFromConversation(activeConversationId!),
    enabled: !!activeConversationId,
  });
  useEffect(() => {
    if (activeConversationId && contactIdFromStore) {
      setIsOpen(true);
      setActiveContactId(contactIdFromStore);
      setView('thread');
      setActiveConversation(null); // consume intent so we don't re-open on next render
    }
  }, [activeConversationId, contactIdFromStore, setActiveConversation]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Per-conversation draft messages (keyed by contactId)
  const draftsRef = useRef<Map<string, string>>(new Map());
  const [currentDraft, setCurrentDraft] = useState<string>('');
  const currentDraftRef = useRef<string>('');
  
  // Modal states
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  
  // Subscribe to new messages
  useMessageSubscription();
  
  // Fetch conversations to calculate unread count
  const { data: conversations } = useConversationsByContact();
  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  
  // Calculate total unread count
  const unreadCount = useMemo(() => {
    if (!conversations) return 0;
    return conversations.reduce((total, conv) => total + conv.unreadCount, 0);
  }, [conversations]);
  const activeAggregated = useMemo(
    () => conversations?.find((c) => c.contactId === activeContactId) || null,
    [conversations, activeContactId]
  );
  const isActiveUnread = !!activeAggregated && activeAggregated.unreadCount > 0;

  const handleToggleReadHeader = () => {
    if (!activeContactId || !activeAggregated) return;
    if (isActiveUnread) {
      const lastMessageId = activeAggregated.latestMessage?.id;
      if (lastMessageId) {
        markRead.mutate({ contactId: activeContactId, lastMessageId });
      }
    } else {
      activeAggregated.conversations.forEach((conv) => {
        markUnread.mutate(conv.id);
      });
    }
  };
  
  // Fetch active contact details for header
  const { data: activeContact } = useQuery({
    queryKey: ['contact', activeContactId],
    queryFn: async () => {
      if (!activeContactId) return null;
      const supabase = getSupabaseClient();
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
        .eq('id', activeContactId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeContactId,
  });
  
  // Track previous contactId to save draft when switching
  const previousContactIdRef = useRef<string | null>(null);
  
  // Manage per-conversation drafts: save current draft when switching conversations
  useEffect(() => {
    // Save draft for previous conversation before switching
    if (previousContactIdRef.current && previousContactIdRef.current !== activeContactId) {
      draftsRef.current.set(previousContactIdRef.current, currentDraftRef.current);
    }
    
    // Restore draft for new conversation
    if (activeContactId) {
      const savedDraft = draftsRef.current.get(activeContactId) || '';
      setCurrentDraft(savedDraft);
      currentDraftRef.current = savedDraft;
    } else {
      setCurrentDraft('');
      currentDraftRef.current = '';
    }
    
    previousContactIdRef.current = activeContactId;
  }, [activeContactId]);
  
  // Handler to update draft for current conversation
  const handleDraftChange = (newDraft: string) => {
    setCurrentDraft(newDraft);
    currentDraftRef.current = newDraft;
    if (activeContactId) {
      draftsRef.current.set(activeContactId, newDraft);
    }
  };
  
  // Handler to clear draft after sending
  const handleDraftClear = () => {
    setCurrentDraft('');
    currentDraftRef.current = '';
    if (activeContactId) {
      draftsRef.current.set(activeContactId, '');
    }
  };
  
  const conversationTitle = activeContact ? formatContactName({ contacts: activeContact }) : 'Messages';
  
  const handleBack = () => {
    setView('list');
    setIsSearching(false);
  };
  
  const handleTitleClick = () => {
    if (!activeContact) return;
    
    const contact = activeContact;
    switch (contact.contact_type) {
      case 'STUDENT':
        if (contact.students?.id) {
          setSelectedStudentId(contact.students.id);
        }
        break;
      case 'STAFF':
        if (contact.staff?.id) {
          setSelectedStaffId(contact.staff.id);
        }
        break;
      case 'PARENT':
        if (contact.parents?.id) {
          setSelectedParentId(contact.parents.id);
        }
        break;
    }
  };
  
  const handleConversationClick = (contactId: string) => {
    setActiveContactId(contactId);
    setView('thread');
  };
  
  // When popover closes, reset to list view
  useEffect(() => {
    if (!isOpen) {
      setView('list');
      setIsSearching(false);
    }
  }, [isOpen]);
  
  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9 relative"
            aria-label={`Messages${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          >
            <MessageCircle className="h-4 w-4" />
            {unreadCount > 0 && (
              <span 
                className={cn(
                  "absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold z-10",
                  unreadCount > 9 && "text-[9px]"
                )}
              >
                {unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          align="end" 
          className="w-[420px] h-[calc(100vh-120px)] max-h-[700px] p-0 flex flex-col"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex h-full overflow-hidden flex-col">
            {/* Conversation List - shown when view is 'list' */}
            {view === 'list' && (
              <div className="w-full h-full flex-shrink-0">
                <ConversationList 
                  activeContactId={activeContactId} 
                  onSelect={handleConversationClick}
                />
              </div>
            )}
            
            {/* Conversation View - shown when view is 'thread' */}
            {view === 'thread' && (
              <div className="w-full h-full flex flex-col min-w-0">
                <ConversationHeader 
                  title={conversationTitle}
                  onSearchToggle={() => setIsSearching(!isSearching)}
                  onTitleClick={activeContact ? handleTitleClick : undefined}
                  onBack={handleBack}
                  showBackButton={true}
                  isUnread={isActiveUnread}
                  onToggleRead={handleToggleReadHeader}
                  contact={activeContact}
                />
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {activeContactId ? (
                    <>
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <MessageThread 
                          contactId={activeContactId} 
                          isSearching={isSearching}
                          searchTerm={searchTerm}
                          onSearchTermChange={setSearchTerm}
                          onExitSearch={() => setIsSearching(false)}
                        />
                      </div>
                      <div className="flex-shrink-0 border-t">
                        <Composer 
                          contactId={activeContactId} 
                          onTyping={() => setIsSearching(false)}
                          draft={currentDraft}
                          onDraftChange={handleDraftChange}
                          onDraftClear={handleDraftClear}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Select a conversation to start messaging
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Modals */}
      {selectedStudentId && (
        <ViewStudentModal
          isOpen={!!selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          studentId={selectedStudentId}
          onStudentUpdated={() => {}}
        />
      )}
      
      {selectedStaffId && (
        <ViewStaffModal
          isOpen={!!selectedStaffId}
          onClose={() => setSelectedStaffId(null)}
          staffId={selectedStaffId}
          onStaffUpdated={() => {}}
        />
      )}
      
      {selectedParentId && (
        <ViewParentModal
          isOpen={!!selectedParentId}
          onClose={() => setSelectedParentId(null)}
          parentId={selectedParentId}
          onParentUpdated={() => {}}
        />
      )}
    </>
  );
}
