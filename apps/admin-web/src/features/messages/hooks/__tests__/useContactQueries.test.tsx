/**
 * Tests for contact query hooks
 */

import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useContactIdFromConversation,
  useContactById,
} from '../useContactQueries';

// Mock Supabase client
jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

// Mock API functions
jest.mock('../../api/contacts', () => ({
  getContactIdFromConversation: jest.fn(),
  getContactById: jest.fn(),
}));

// Import mocked functions
import {
  getContactIdFromConversation,
  getContactById,
} from '../../api/contacts';

const mockGetContactIdFromConversation = getContactIdFromConversation as jest.MockedFunction<typeof getContactIdFromConversation>;
const mockGetContactById = getContactById as jest.MockedFunction<typeof getContactById>;

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

describe('Contact Query Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useContactIdFromConversation', () => {
    it('should fetch contact ID from conversation ID', async () => {
      const conversationId = 'conv-1';
      const contactId = 'contact-1';
      
      mockGetContactIdFromConversation.mockResolvedValue(contactId);

      const { result } = renderHook(
        () => useContactIdFromConversation(conversationId),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBe(contactId);
      expect(mockGetContactIdFromConversation).toHaveBeenCalledWith(conversationId);
    });

    it('should return null when conversationId is null', async () => {
      const { result } = renderHook(
        () => useContactIdFromConversation(null),
        { wrapper: createWrapper() }
      );

      // When query is disabled (enabled: false), React Query doesn't call queryFn
      // so data is undefined, not null
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockGetContactIdFromConversation).not.toHaveBeenCalled();
    });

    it('should not fetch when conversationId is undefined', async () => {
      const { result } = renderHook(
        () => useContactIdFromConversation(undefined),
        { wrapper: createWrapper() }
      );

      // When query is disabled (enabled: false), React Query doesn't call queryFn
      // so data is undefined, not null
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockGetContactIdFromConversation).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const conversationId = 'conv-1';
      const error = new Error('Failed to fetch');
      
      mockGetContactIdFromConversation.mockRejectedValue(error);

      const { result } = renderHook(
        () => useContactIdFromConversation(conversationId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(error);
    });
  });

  describe('useContactById', () => {
    it('should fetch contact by ID', async () => {
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

      mockGetContactById.mockResolvedValue(mockContact);

      const { result } = renderHook(
        () => useContactById(contactId),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockContact);
      expect(mockGetContactById).toHaveBeenCalledWith(contactId);
    });

    it('should return null when contactId is null', async () => {
      const { result } = renderHook(
        () => useContactById(null),
        { wrapper: createWrapper() }
      );

      // When query is disabled (enabled: false), React Query doesn't call queryFn
      // so data is undefined, not null
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockGetContactById).not.toHaveBeenCalled();
    });

    it('should handle contact not found', async () => {
      const contactId = 'contact-1';
      
      mockGetContactById.mockResolvedValue(null);

      const { result } = renderHook(
        () => useContactById(contactId),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });
  });
});
