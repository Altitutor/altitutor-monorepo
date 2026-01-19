'use client';

import { useQuery } from '@tanstack/react-query';
import { messagesKeys } from '../api/queryKeys';
import {
  getContactIdFromConversation,
  getContactById,
} from '../api/contacts';

/**
 * Get contact ID from conversation ID
 */
export function useContactIdFromConversation(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ['contact-from-conversation', conversationId],
    queryFn: () => {
      if (!conversationId) return null;
      return getContactIdFromConversation(conversationId);
    },
    enabled: !!conversationId,
  });
}

/**
 * Get contact by ID with all related data
 */
export function useContactById(contactId: string | null | undefined) {
  return useQuery({
    queryKey: messagesKeys.conversationContact(contactId || ''),
    queryFn: () => {
      if (!contactId) return null;
      return getContactById(contactId);
    },
    enabled: !!contactId,
  });
}
