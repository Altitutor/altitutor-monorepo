'use client';

import { ConversationList } from '@/features/messages/components/ConversationList';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { ConversationHeader } from '@/features/messages/components/ConversationHeader';
import { Composer } from '@/features/messages/components/Composer';
import { InfoPanel } from '@/features/messages/components/InfoPanel';
import { InfoModal } from '@/features/messages/components/InfoModal';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatContactName } from '@/features/messages/utils/formatContactName';
import { useMarkUnread } from '@/features/messages/api/mutations';
import { useToast } from '@altitutor/ui';

export default function CommunicationsPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const { toast } = useToast();
  
  const markUnread = useMarkUnread();
  
  // Fetch active conversation details for header
  const { data: activeConversation } = useQuery({
    queryKey: ['conversation', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return null;
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
        .eq('id', activeConversationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeConversationId,
  });
  
  useEffect(() => {
    // Auto-select most recent conversation when present
    (async () => {
      const supabase = getSupabaseClient() as any;
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) setActiveConversationId(data.id);
    })();
  }, []);
  
  const conversationTitle = activeConversation ? formatContactName(activeConversation) : 'Messages';
  
  const handleConversationSelect = (id: string) => {
    setActiveConversationId(id);
    setMobileView('thread');
  };
  
  const handleBack = () => {
    setMobileView('list');
  };
  
  const handleMarkUnread = async () => {
    if (!activeConversationId) return;
    try {
      await markUnread.mutateAsync(activeConversationId);
      toast({
        title: "Success",
        description: "Conversation marked as unread.",
      });
    } catch (error) {
      console.error('Failed to mark as unread:', error);
      toast({
        title: "Error",
        description: "Failed to mark conversation as unread.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="p-0 h-full">
      <div className="flex h-[calc(100vh-var(--navbar-height))]">
        {/* Conversation List - hidden on mobile when viewing thread */}
        <div className={`w-[340px] flex-shrink-0 ${mobileView === 'thread' ? 'hidden lg:block' : 'block'} lg:block`}>
          <ConversationList activeConversationId={activeConversationId} onSelect={handleConversationSelect} />
        </div>
        
        {/* Messages - hidden on mobile when viewing list */}
        <div className={`flex-1 flex flex-col min-w-0 ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'} lg:flex`}>
          <ConversationHeader 
            title={conversationTitle}
            onSearchToggle={() => setIsSearching(!isSearching)}
            onInfoToggle={() => setShowInfoModal(true)}
            onMarkUnread={activeConversationId ? handleMarkUnread : undefined}
            onBack={handleBack}
            showBackButton={mobileView === 'thread'}
          />
          <div className="flex-1 flex flex-col min-h-0">
            {activeConversationId ? (
              <>
                <MessageThread 
                  conversationId={activeConversationId} 
                  isSearching={isSearching}
                  searchTerm={searchTerm}
                  onSearchTermChange={setSearchTerm}
                  onExitSearch={() => setIsSearching(false)}
                />
                <Composer conversationId={activeConversationId} onTyping={() => setIsSearching(false)} />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a conversation to start messaging
              </div>
            )}
          </div>
        </div>
        
        {/* Info Panel - hidden on mobile, shown on desktop */}
        <div className="hidden lg:block w-[380px] flex-shrink-0">
          <InfoPanel conversationId={activeConversationId} />
        </div>
      </div>
      
      {/* Info Modal for mobile */}
      <InfoModal 
        conversationId={activeConversationId}
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
      />
    </div>
  );
}


