/**
 * Tests for contact API functions
 */

import {
  getContactIdFromConversation,
  getContactById,
} from '../contacts';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

// Mock Supabase client
jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

describe('Contact API Functions', () => {
  let mockSupabase: {
    from: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn(),
    };

    mockGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);
  });

  describe('getContactIdFromConversation', () => {
    it('should return contact ID from conversation', async () => {
      const conversationId = 'conv-1';
      const contactId = 'contact-1';

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { contact_id: contactId },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getContactIdFromConversation(conversationId);

      expect(result).toBe(contactId);
      expect(mockSupabase.from).toHaveBeenCalledWith('conversations');
      expect(mockQuery.select).toHaveBeenCalledWith('contact_id');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', conversationId);
    });

    it('should return null when conversation not found', async () => {
      const conversationId = 'conv-1';

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getContactIdFromConversation(conversationId);

      expect(result).toBeNull();
    });

    it('should throw error when query fails', async () => {
      const conversationId = 'conv-1';
      const error = new Error('Database error');

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(getContactIdFromConversation(conversationId)).rejects.toThrow('Database error');
    });
  });

  describe('getContactById', () => {
    it('should return contact with all relations', async () => {
      const contactId = 'contact-1';
      const mockContact = {
        id: contactId,
        phone_e164: '+1234567890',
        contact_type: 'STUDENT',
        student_id: 'student-1',
        parent_id: null,
        staff_id: null,
        students: {
          id: 'student-1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          status: 'ACTIVE',
          year_level: 10,
          curriculum: 'IB',
          user_id: 'user-1',
        },
        parents: null,
        staff: null,
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockContact,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getContactById(contactId);

      expect(result).toEqual(mockContact);
      expect(mockSupabase.from).toHaveBeenCalledWith('contacts');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', contactId);
    });

    it('should return null when contact not found', async () => {
      const contactId = 'contact-1';

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await getContactById(contactId);

      expect(result).toBeNull();
    });
  });
});
