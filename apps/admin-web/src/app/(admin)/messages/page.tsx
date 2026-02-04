'use client';

import { ConversationList } from '@/features/messages/components/ConversationList';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { ConversationHeader } from '@/features/messages/components/ConversationHeader';
import { Composer } from '@/features/messages/components/Composer';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatContactName } from '@/features/messages/utils/formatContactName';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationParam = searchParams.get('conversation'); // For backward compatibility
  const contactParam = searchParams.get('contact');
  const [activeContactId, setActiveContactId] = useState<string | null>(contactParam);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Per-conversation draft messages (keyed by contactId)
  const draftsRef = useRef<Map<string, string>>(new Map());
  const [currentDraft, setCurrentDraft] = useState<string>('');
  const currentDraftRef = useRef<string>(''); // Keep latest draft value for saving on switch
  
  // Modal states
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  
  // Convert conversationId to contactId if provided (backward compatibility)
  useEffect(() => {
    if (conversationParam && !contactParam) {
      const supabase = getSupabaseClient();
      supabase
        .from('conversations')
        .select('contact_id')
        .eq('id', conversationParam)
        .maybeSingle<{ contact_id: string }>()
        .then(({ data }) => {
          if (data?.contact_id) {
            setActiveContactId(data.contact_id);
            // Update URL to use contact instead of conversation
            const params = new URLSearchParams(searchParams.toString());
            params.delete('conversation');
            params.set('contact', data.contact_id);
            router.replace(`/messages?${params.toString()}`);
          }
        });
    }
  }, [conversationParam, contactParam, searchParams, router]);
  
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
  
  // Sync from URL params
  useEffect(() => {
    const contactId = searchParams.get('contact');
    if (contactId) {
      setActiveContactId(contactId);
    } else if (!activeContactId && !conversationParam) {
      // Auto-select most recent contact when no URL param
      (async () => {
        // This will be handled by the hook, but we can select the first one
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('conversations')
          .select('contact_id')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle<{ contact_id: string }>();
        if (data?.contact_id) {
          setActiveContactId(data.contact_id);
          const params = new URLSearchParams(searchParams.toString());
          params.set('contact', data.contact_id);
          router.push(`/messages?${params.toString()}`);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  
  // Track previous contactId to save draft when switching
  const previousContactIdRef = useRef<string | null>(null);
  
  // Manage per-conversation drafts: save current draft when switching conversations
  useEffect(() => {
    // Save draft for previous conversation before switching (use ref to get latest value)
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
  
  // Handler to clear draft after sending (called from Composer)
  const handleDraftClear = () => {
    setCurrentDraft('');
    currentDraftRef.current = '';
    if (activeContactId) {
      draftsRef.current.set(activeContactId, '');
    }
  };
  
  const conversationTitle = activeContact ? formatContactName({ contacts: activeContact }) : 'Messages';
  
  const handleContactSelect = (contactId: string) => {
    setActiveContactId(contactId);
    setMobileView('thread');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('conversation'); // Remove old param
    params.set('contact', contactId);
    router.push(`/messages?${params.toString()}`);
  };
  
  const handleBack = () => {
    setMobileView('list');
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
  
  return (
    <div className="p-0 h-full overflow-hidden">
      <div className="flex h-full">
        {/* Conversation List 
            - Mobile (< md): Full width when viewing list, hidden when viewing thread
            - Medium (md-xl): Fixed 260px, always visible alongside messages
            - Wide (xl+): Fixed 260px, always visible with info panel
        */}
        <div className={`
          flex-shrink-0
          ${mobileView === 'thread' ? 'hidden md:block' : 'w-full md:w-[260px]'}
          md:w-[260px]
        `}>
          <ConversationList 
            activeContactId={activeContactId} 
            onSelect={handleContactSelect}
          />
        </div>
        
        {/* Messages 
            - Mobile (< md): Full width when viewing thread, hidden when viewing list
            - Medium (md+): Always visible, flex-1
        */}
        <div className={`
          flex-1 flex-col min-w-0
          ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
        `}>
          <ConversationHeader 
            title={conversationTitle}
            onSearchToggle={() => setIsSearching(!isSearching)}
            onTitleClick={activeContact ? handleTitleClick : undefined}
            onBack={handleBack}
            showBackButton={mobileView === 'thread'}
          />
          <div className="flex-1 flex flex-col min-h-0">
            {activeContactId ? (
              <>
                <MessageThread 
                  contactId={activeContactId} 
                  isSearching={isSearching}
                  searchTerm={searchTerm}
                  onSearchTermChange={setSearchTerm}
                  onExitSearch={() => setIsSearching(false)}
                />
                <Composer 
                  contactId={activeContactId} 
                  onTyping={() => setIsSearching(false)}
                  draft={currentDraft}
                  onDraftChange={handleDraftChange}
                  onDraftClear={handleDraftClear}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a conversation to start messaging
              </div>
            )}
          </div>
        </div>
        
      </div>
      
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
    </div>
  );
}


