/**
 * Tests for useParentMutations hook
 * Tests parent update and student assignment mutations
 */

import { act, waitFor } from '@testing-library/react';
import { useParentMutations } from '../useParentMutations';
import { studentsApi } from '@/features/students/api/students';
import { renderHookWithProviders } from '@/shared/test-utils';

// Mock dependencies
jest.mock('@/features/students/api/students');

const mockStudentsApi = studentsApi as jest.Mocked<typeof studentsApi>;

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
