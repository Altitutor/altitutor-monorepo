import type { Tables } from '@altitutor/shared';

/**
 * Type for conversation returned by useConversations query
 * Represents a conversation with all its related data (contacts, reads, etc.)
 */
export type ConversationWithRelations = {
  id: string;
  status: string;
  last_message_at: string | null;
  last_message_id: string | null;
  assigned_staff_id: string | null;
  contact_id: string | null;
  owned_number_id: string;
  is_group_chat: boolean;
  group_chat_id: string | null;
  group_chat_name: string | null;
  contacts: {
    id: string;
    phone_e164: string | null;
    contact_type: string;
    student_id?: string | null;
    parent_id?: string | null;
    staff_id?: string | null;
    students: Pick<Tables<'students'>, 'id' | 'first_name' | 'last_name'> | null;
    parents: {
      id: string;
      first_name: string;
      last_name: string;
      parents_students?: Array<{
        students: Pick<Tables<'students'>, 'id' | 'first_name' | 'last_name'>;
      }>;
    } | null;
    staff: Pick<Tables<'staff'>, 'id' | 'first_name' | 'last_name'> | null;
  } | null;
  owned_numbers: Pick<Tables<'owned_numbers'>, 'id' | 'phone_e164' | 'label'> | null;
  conversation_reads: Array<Pick<Tables<'conversation_reads'>, 'id' | 'last_read_message_id' | 'last_read_at'>>;
  messages?: { id: string; direction: string } | null;
};

/**
 * Sender type for owned numbers used in messaging
 */
export type Sender = {
  id: string;
  phone_e164: string | null;
  alphanumeric_sender_id: string | null;
  sender_type: 'PHONE' | 'ALPHANUMERIC';
  label: string | null;
  is_default: boolean;
};

/**
 * Aggregated conversation type - groups multiple conversations by contact
 */
export type AggregatedConversation = {
  contactId: string;
  contact: ConversationWithRelations['contacts'];
  conversations: Array<{
    id: string;
    owned_number_id: string;
    owned_number: Pick<Tables<'owned_numbers'>, 'id' | 'phone_e164' | 'label'> | null;
    last_message_at: string | null;
    last_message_id: string | null;
    last_message: { id: string; direction: string } | null;
    status: string;
  }>;
  latestMessageAt: string | null;
  latestMessage: { id: string; direction: string } | null;
  unreadCount: number;
};
