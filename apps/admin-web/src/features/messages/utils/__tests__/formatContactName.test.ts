/**
 * Tests for formatContactName utility
 * Tests contact name formatting for different contact types
 */

import { formatContactName } from '../formatContactName';
import type { ConversationWithRelations } from '../../types';

describe('formatContactName', () => {
  describe('STUDENT contacts', () => {
    it('should format student name from first and last name', () => {
      const conversation: ConversationWithRelations = {
        id: 'conv-1',
        status: 'ACTIVE',
        contact_id: 'contact-1',
        last_message_at: null,
        last_message_id: null,
        assigned_staff_id: null,
        owned_number_id: 'owned-1',
        is_group_chat: false,
        group_chat_id: null,
        group_chat_name: null,
        owned_numbers: null,
        conversation_reads: [],
        contacts: {
          id: 'contact-1',
          contact_type: 'STUDENT',
          phone_e164: '+61412345678',
          students: {
            id: 'student-1',
            first_name: 'John',
            last_name: 'Doe',
          },
          parents: null,
          staff: null,
        },
      };

      expect(formatContactName(conversation)).toBe('John Doe');
    });

    it('should use phone number when student data is missing', () => {
      const conversation: ConversationWithRelations = {
        id: 'conv-1',
        status: 'ACTIVE',
        contact_id: 'contact-1',
        last_message_at: null,
        last_message_id: null,
        assigned_staff_id: null,
        owned_number_id: 'owned-1',
        is_group_chat: false,
        group_chat_id: null,
        group_chat_name: null,
        owned_numbers: null,
        conversation_reads: [],
        contacts: {
          id: 'contact-1',
          contact_type: 'STUDENT',
          phone_e164: '+61412345678',
          students: null,
          parents: null,
          staff: null,
        },
      };

      expect(formatContactName(conversation)).toBe('+61412345678');
    });

    it('should return "Unknown" when student and phone are missing', () => {
      const conversation: ConversationWithRelations = {
        id: 'conv-1',
        status: 'ACTIVE',
        contact_id: 'contact-1',
        last_message_at: null,
        last_message_id: null,
        assigned_staff_id: null,
        owned_number_id: 'owned-1',
        is_group_chat: false,
        group_chat_id: null,
        group_chat_name: null,
        owned_numbers: null,
        conversation_reads: [],
        contacts: {
          id: 'contact-1',
          contact_type: 'STUDENT',
          phone_e164: null,
          students: null,
          parents: null,
          staff: null,
        },
      };

      expect(formatContactName(conversation)).toBe('Unknown');
    });
  });

  describe('PARENT contacts', () => {
    it('should format parent name', () => {
      const conversation: ConversationWithRelations = {
        id: 'conv-1',
        status: 'ACTIVE',
        contact_id: 'contact-1',
        last_message_at: null,
        last_message_id: null,
        assigned_staff_id: null,
        owned_number_id: 'owned-1',
        is_group_chat: false,
        group_chat_id: null,
        group_chat_name: null,
        owned_numbers: null,
        conversation_reads: [],
        contacts: {
          id: 'contact-1',
          contact_type: 'PARENT',
          phone_e164: '+61412345678',
          students: null,
          parents: {
            id: 'parent-1',
            first_name: 'Jane',
            last_name: 'Smith',
            parents_students: [],
          },
          staff: null,
        },
      };

      expect(formatContactName(conversation)).toBe('Jane Smith');
    });

    it('should include student name when parent has linked students', () => {
      const conversation: ConversationWithRelations = {
        id: 'conv-1',
        status: 'ACTIVE',
        contact_id: 'contact-1',
        last_message_at: null,
        last_message_id: null,
        assigned_staff_id: null,
        owned_number_id: 'owned-1',
        is_group_chat: false,
        group_chat_id: null,
        group_chat_name: null,
        owned_numbers: null,
        conversation_reads: [],
        contacts: {
          id: 'contact-1',
          contact_type: 'PARENT',
          phone_e164: '+61412345678',
          students: null,
          parents: {
            id: 'parent-1',
            first_name: 'Jane',
            last_name: 'Smith',
            parents_students: [
              {
                students: {
                  id: 'student-1',
                  first_name: 'Alice',
                  last_name: 'Smith',
                },
              },
            ],
          },
          staff: null,
        },
      };

      expect(formatContactName(conversation)).toBe('Jane Smith (parent of Alice Smith)');
    });

    it('should use phone number when parent data is missing', () => {
      const conversation: ConversationWithRelations = {
        id: 'conv-1',
        status: 'ACTIVE',
        contact_id: 'contact-1',
        last_message_at: null,
        last_message_id: null,
        assigned_staff_id: null,
        owned_number_id: 'owned-1',
        is_group_chat: false,
        group_chat_id: null,
        group_chat_name: null,
        owned_numbers: null,
        conversation_reads: [],
        contacts: {
          id: 'contact-1',
          contact_type: 'PARENT',
          phone_e164: '+61412345678',
          students: null,
          parents: null,
          staff: null,
        },
      };

      expect(formatContactName(conversation)).toBe('+61412345678');
    });
  });

  describe('STAFF contacts', () => {
    it('should format staff name', () => {
      const conversation: ConversationWithRelations = {
        id: 'conv-1',
        status: 'ACTIVE',
        contact_id: 'contact-1',
        last_message_at: null,
        last_message_id: null,
        assigned_staff_id: null,
        owned_number_id: 'owned-1',
        is_group_chat: false,
        group_chat_id: null,
        group_chat_name: null,
        owned_numbers: null,
        conversation_reads: [],
        contacts: {
          id: 'contact-1',
          contact_type: 'STAFF',
          phone_e164: '+61412345678',
          students: null,
          parents: null,
          staff: {
            id: 'staff-1',
            first_name: 'Bob',
            last_name: 'Johnson',
          },
        },
      };

      expect(formatContactName(conversation)).toBe('Bob Johnson');
    });

    it('should use phone number when staff data is missing', () => {
      const conversation: ConversationWithRelations = {
        id: 'conv-1',
        status: 'ACTIVE',
        contact_id: 'contact-1',
        last_message_at: null,
        last_message_id: null,
        assigned_staff_id: null,
        owned_number_id: 'owned-1',
        is_group_chat: false,
        group_chat_id: null,
        group_chat_name: null,
        owned_numbers: null,
        conversation_reads: [],
        contacts: {
          id: 'contact-1',
          contact_type: 'STAFF',
          phone_e164: '+61412345678',
          students: null,
          parents: null,
          staff: null,
        },
      };

      expect(formatContactName(conversation)).toBe('+61412345678');
    });
  });

  describe('LEAD or unknown contacts', () => {
    it('should return phone number for LEAD contacts', () => {
      const conversation: ConversationWithRelations = {
        id: 'conv-1',
        status: 'ACTIVE',
        contact_id: 'contact-1',
        last_message_at: null,
        last_message_id: null,
        assigned_staff_id: null,
        owned_number_id: 'owned-1',
        is_group_chat: false,
        group_chat_id: null,
        group_chat_name: null,
        owned_numbers: null,
        conversation_reads: [],
        contacts: {
          id: 'contact-1',
          contact_type: 'LEAD',
          phone_e164: '+61412345678',
          students: null,
          parents: null,
          staff: null,
        },
      };

      expect(formatContactName(conversation)).toBe('+61412345678');
    });

    it('should return "Unknown" when phone is missing for LEAD', () => {
      const conversation: ConversationWithRelations = {
        id: 'conv-1',
        status: 'ACTIVE',
        contact_id: 'contact-1',
        last_message_at: null,
        last_message_id: null,
        assigned_staff_id: null,
        owned_number_id: 'owned-1',
        is_group_chat: false,
        group_chat_id: null,
        group_chat_name: null,
        owned_numbers: null,
        conversation_reads: [],
        contacts: {
          id: 'contact-1',
          contact_type: 'LEAD',
          phone_e164: null,
          students: null,
          parents: null,
          staff: null,
        },
      };

      expect(formatContactName(conversation)).toBe('Unknown');
    });
  });

  describe('edge cases', () => {
    it('should handle empty contact object', () => {
      const conversation: ConversationWithRelations = {
        id: 'conv-1',
        status: 'ACTIVE',
        contact_id: null,
        owned_number_id: 'owned-1',
        is_group_chat: false,
        group_chat_id: null,
        group_chat_name: null,
        last_message_at: null,
        last_message_id: null,
        assigned_staff_id: null,
        contacts: null,
        owned_numbers: null,
        conversation_reads: [],
      };

      expect(formatContactName(conversation)).toBe('Unknown');
    });

    it('should handle contact with only contacts property', () => {
      const contactOnly = {
        contacts: {
          id: 'contact-1',
          contact_type: 'STUDENT',
          phone_e164: '+61412345678',
          students: {
            id: 'student-1',
            first_name: 'John',
            last_name: 'Doe',
          },
          parents: null,
          staff: null,
        },
      };

      expect(formatContactName(contactOnly)).toBe('John Doe');
    });

    it('should trim outer whitespace from names', () => {
      const conversation: ConversationWithRelations = {
        id: 'conv-1',
        status: 'ACTIVE',
        contact_id: 'contact-1',
        last_message_at: null,
        last_message_id: null,
        assigned_staff_id: null,
        owned_number_id: 'owned-1',
        is_group_chat: false,
        group_chat_id: null,
        group_chat_name: null,
        owned_numbers: null,
        conversation_reads: [],
        contacts: {
          id: 'contact-1',
          contact_type: 'STUDENT',
          phone_e164: '+61412345678',
          students: {
            id: 'student-1',
            first_name: '  John  ',
            last_name: '  Doe  ',
          },
          parents: null,
          staff: null,
        },
      };

      // Function trims outer whitespace but preserves inner spacing
      expect(formatContactName(conversation)).toBe('John     Doe');
    });
  });
});
