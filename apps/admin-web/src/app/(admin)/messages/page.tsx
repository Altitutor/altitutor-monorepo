'use client';

import { ConversationList } from '@/features/messages/components/ConversationList';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { ConversationHeader } from '@/features/messages/components/ConversationHeader';
import { Composer } from '@/features/messages/components/Composer';
import { InfoPanel } from '@/features/messages/components/InfoPanel';
import { InfoModal } from '@/features/messages/components/InfoModal';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatContactName } from '@/features/messages/utils/formatContactName';

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationParam = searchParams.get('conversation'); // For backward compatibility
  const contactParam = searchParams.get('contact');
  const [activeContactId, setActiveContactId] = useState<string | null>(contactParam);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  // Convert conversationId to contactId if provided (backward compatibility)
  useEffect(() => {
    if (conversationParam && !contactParam) {
      const supabase = getSupabaseClient() as any;
      supabase
        .from('conversations')
        .select('contact_id')
        .eq('id', conversationParam)
        .maybeSingle()
        .then(({ data }: any) => {
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
      const supabase = getSupabaseClient() as any;
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
        const supabase = getSupabaseClient() as any;
        const { data } = await supabase
          .from('conversations')
          .select('contact_id')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();
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
            onInfoToggle={() => setShowInfoModal(true)}
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
                <Composer contactId={activeContactId} onTyping={() => setIsSearching(false)} />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a conversation to start messaging
              </div>
            )}
          </div>
        </div>
        
        {/* Info Panel 
            - Hidden on mobile and medium (< xl)
            - Shown on wide screens (xl+): 480px fixed width
        */}
        <div className="hidden xl:flex xl:flex-col w-[480px] flex-shrink-0 min-h-0">
          <InfoPanel contactId={activeContactId} className="flex-1 overflow-y-auto" />
        </div>
      </div>
      
      {/* Info Modal for mobile and medium screens */}
      <InfoModal 
        contactId={activeContactId}
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
      />
    </div>
  );
}


