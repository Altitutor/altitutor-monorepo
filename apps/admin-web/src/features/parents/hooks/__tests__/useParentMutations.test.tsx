/**
 * Tests for useParentMutations hook
 * Tests parent update and student assignment mutations
 */

import { act, waitFor } from '@testing-library/react';
import { useParentMutations } from '../useParentMutations';
import { studentsApi } from '@/features/students/api/students';
import { renderHookWithProviders } from '@/shared/test-utils';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

// Mock dependencies
jest.mock('@/features/students/api/students');
jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

const mockStudentsApi = studentsApi as jest.Mocked<typeof studentsApi>;
const mockToast = jest.fn();
jest.mock('@altitutor/ui', () => ({
  ...jest.requireActual<typeof import('@altitutor/ui')>('@altitutor/ui'),
  useToast: () => ({ toast: mockToast }),
}));

describe('useParentMutations', () => {
  const mockParentId = 'parent-1';
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockStudentsApi.updateParent.mockResolvedValue({ id: mockParentId, first_name: '', last_name: '', email: null, phone: null } as unknown as Awaited<ReturnType<typeof mockStudentsApi.updateParent>>);
    mockStudentsApi.assignStudentToParent.mockResolvedValue({} as unknown as Awaited<ReturnType<typeof mockStudentsApi.assignStudentToParent>>);
    mockStudentsApi.removeStudentFromParent.mockResolvedValue(undefined);
  });

  describe('updateDetails', () => {
    it('handles a confirmed phone conflict once, keeping the edit open and skipping student changes', async () => {
      const actual = jest.requireActual<typeof import('@/features/students/api/students')>('@/features/students/api/students');
      mockStudentsApi.updateParent.mockImplementation(actual.studentsApi.updateParent);
      const query = {
        update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: {
          code: 'P0001',
          message: 'Phone number fixture-number is already associated with a student (ID: fixture-student)',
        } }),
      };
      jest.mocked(getSupabaseClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof getSupabaseClient>);
      const { result } = renderHookWithProviders(() => useParentMutations({ parentId: mockParentId, onSuccess: mockOnSuccess }));
      await act(async () => {
        await expect(result.current.updateDetails({ firstName: 'Fixture', lastName: 'Parent', phone: 'fixture-number', email: '' }, {
          toAdd: ['fixture-student'], toRemove: [],
        })).resolves.toBeUndefined();
      });
      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith({ title: 'Error', variant: 'destructive',
        description: 'This phone number is already linked to a student. Use a different number for the parent, or check the student contact details.',
      });
      expect(mockStudentsApi.assignStudentToParent).not.toHaveBeenCalled();
      expect(result.current.isUpdatingDetails).toBe(false);
    });

    it('should update parent details successfully', async () => {
      const { result } = renderHookWithProviders(() =>
        useParentMutations({ parentId: mockParentId, onSuccess: mockOnSuccess })
      );

      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+61412345678',
      };

      await act(async () => {
        await result.current.updateDetails(
          formData,
          { toAdd: [], toRemove: [] }
        );
      });

      expect(mockStudentsApi.updateParent).toHaveBeenCalledWith(mockParentId, {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '+61412345678',
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should handle null email and phone', async () => {
      const { result } = renderHookWithProviders(() =>
        useParentMutations({ parentId: mockParentId })
      );

      const formData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: '',
        phone: '',
      };

      await act(async () => {
        await result.current.updateDetails(
          formData,
          { toAdd: [], toRemove: [] }
        );
      });

      expect(mockStudentsApi.updateParent).toHaveBeenCalledWith(mockParentId, {
        first_name: 'Jane',
        last_name: 'Smith',
        email: null,
        phone: null,
      });
    });

    it('should handle student additions', async () => {
      const { result } = renderHookWithProviders(() =>
        useParentMutations({ parentId: mockParentId })
      );

      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: '',
        phone: '',
      };

      await act(async () => {
        await result.current.updateDetails(
          formData,
          { toAdd: ['student-1', 'student-2'], toRemove: [] }
        );
      });

      expect(mockStudentsApi.assignStudentToParent).toHaveBeenCalledTimes(2);
      expect(mockStudentsApi.assignStudentToParent).toHaveBeenCalledWith(mockParentId, 'student-1');
      expect(mockStudentsApi.assignStudentToParent).toHaveBeenCalledWith(mockParentId, 'student-2');
    });

    it('should handle student removals', async () => {
      const { result } = renderHookWithProviders(() =>
        useParentMutations({ parentId: mockParentId })
      );

      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: '',
        phone: '',
      };

      await act(async () => {
        await result.current.updateDetails(
          formData,
          { toAdd: [], toRemove: ['student-1'] }
        );
      });

      expect(mockStudentsApi.removeStudentFromParent).toHaveBeenCalledWith(mockParentId, 'student-1');
    });

    it('should handle complex updates with all changes', async () => {
      const { result } = renderHookWithProviders(() =>
        useParentMutations({ parentId: mockParentId })
      );

      const formData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '+61412345678',
      };

      await act(async () => {
        await result.current.updateDetails(
          formData,
          { toAdd: ['student-1'], toRemove: ['student-2'] }
        );
      });

      expect(mockStudentsApi.updateParent).toHaveBeenCalled();
      expect(mockStudentsApi.assignStudentToParent).toHaveBeenCalled();
      expect(mockStudentsApi.removeStudentFromParent).toHaveBeenCalled();
    });

    it('should set isUpdatingDetails during update', async () => {
      let resolveUpdate: () => void;
      const updatePromise = new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      });

      mockStudentsApi.updateParent.mockReturnValue(updatePromise as unknown as ReturnType<typeof mockStudentsApi.updateParent>);

      const { result } = renderHookWithProviders(() =>
        useParentMutations({ parentId: mockParentId })
      );

      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: '',
        phone: '',
      };

      act(() => {
        result.current.updateDetails(formData, { toAdd: [], toRemove: [] });
      });

      expect(result.current.isUpdatingDetails).toBe(true);

      await act(async () => {
        resolveUpdate!();
        await updatePromise;
      });

      await waitFor(() => {
        expect(result.current.isUpdatingDetails).toBe(false);
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Update failed');
      mockStudentsApi.updateParent.mockRejectedValue(error);

      const { result } = renderHookWithProviders(() =>
        useParentMutations({ parentId: mockParentId })
      );

      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: '',
        phone: '',
      };

      await expect(
        act(async () => {
          await result.current.updateDetails(formData, { toAdd: [], toRemove: [] });
        })
      ).rejects.toThrow('Update failed');
    });
  });
});
