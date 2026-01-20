/**
 * Tests for useStudentMutations hook
 * Tests complex mutation orchestration for student updates and deletions
 */

import { act, waitFor } from '@testing-library/react';
import { useStudentMutations } from '../useStudentMutations';
import {
  useUpdateStudent,
  useDeleteStudent,
  useAssignSubjectToStudent,
  useRemoveSubjectFromStudent,
  useAssignParentToStudent,
  useRemoveParentFromStudent,
} from '../useStudentsQuery';
import { mapDetailsFormToStudentUpdate } from '../../mappers/studentMappers';
import { renderHookWithProviders } from '@/shared/test-utils';

// Mock dependencies
jest.mock('../useStudentsQuery');
jest.mock('../../mappers/studentMappers');

const mockUseUpdateStudent = useUpdateStudent as jest.MockedFunction<typeof useUpdateStudent>;
const mockUseDeleteStudent = useDeleteStudent as jest.MockedFunction<typeof useDeleteStudent>;
const mockUseAssignSubjectToStudent = useAssignSubjectToStudent as jest.MockedFunction<typeof useAssignSubjectToStudent>;
const mockUseRemoveSubjectFromStudent = useRemoveSubjectFromStudent as jest.MockedFunction<typeof useRemoveSubjectFromStudent>;
const mockUseAssignParentToStudent = useAssignParentToStudent as jest.MockedFunction<typeof useAssignParentToStudent>;
const mockUseRemoveParentFromStudent = useRemoveParentFromStudent as jest.MockedFunction<typeof useRemoveParentFromStudent>;
const mockMapDetailsFormToStudentUpdate = mapDetailsFormToStudentUpdate as jest.MockedFunction<typeof mapDetailsFormToStudentUpdate>;

describe('useStudentMutations', () => {
  const mockStudentId = 'student-1';
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock mutations
    mockUseUpdateStudent.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    } as any);

    mockUseDeleteStudent.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    } as any);

    mockUseAssignSubjectToStudent.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    } as any);

    mockUseRemoveSubjectFromStudent.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    } as any);

    mockUseAssignParentToStudent.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    } as any);

    mockUseRemoveParentFromStudent.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    } as any);

    mockMapDetailsFormToStudentUpdate.mockReturnValue({
      first_name: 'John',
      last_name: 'Doe',
    } as any);
  });

  describe('updateDetails', () => {
    it('should update student details successfully', async () => {
      const { result } = renderHookWithProviders(() =>
        useStudentMutations({ studentId: mockStudentId, onSuccess: mockOnSuccess })
      );

      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+61412345678',
        school: 'Test School',
        yearLevel: 10,
        curriculum: 'IB' as const,
        status: 'ACTIVE' as const,
        availability_monday: true,
        availability_tuesday: true,
        availability_wednesday: true,
        availability_thursday: true,
        availability_friday: true,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
      };

      await act(async () => {
        await result.current.updateDetails(
          formData,
          { toAdd: [], toRemove: [] },
          { toAdd: [], toRemove: [] }
        );
      });

      expect(mockMapDetailsFormToStudentUpdate).toHaveBeenCalledWith(formData);
      expect(mockUseUpdateStudent().mutateAsync).toHaveBeenCalledWith({
        id: mockStudentId,
        data: { first_name: 'John', last_name: 'Doe' },
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should handle subject additions', async () => {
      const { result } = renderHookWithProviders(() =>
        useStudentMutations({ studentId: mockStudentId })
      );

      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: '',
        phone: '',
        school: '',
        yearLevel: undefined,
        curriculum: undefined,
        status: 'ACTIVE' as const,
        availability_monday: false,
        availability_tuesday: false,
        availability_wednesday: false,
        availability_thursday: false,
        availability_friday: false,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
      };

      await act(async () => {
        await result.current.updateDetails(
          formData,
          { toAdd: ['subject-1', 'subject-2'], toRemove: [] },
          { toAdd: [], toRemove: [] }
        );
      });

      expect(mockUseAssignSubjectToStudent().mutateAsync).toHaveBeenCalledTimes(2);
      expect(mockUseAssignSubjectToStudent().mutateAsync).toHaveBeenCalledWith({
        studentId: mockStudentId,
        subjectId: 'subject-1',
      });
      expect(mockUseAssignSubjectToStudent().mutateAsync).toHaveBeenCalledWith({
        studentId: mockStudentId,
        subjectId: 'subject-2',
      });
    });

    it('should handle subject removals', async () => {
      const { result } = renderHookWithProviders(() =>
        useStudentMutations({ studentId: mockStudentId })
      );

      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: '',
        phone: '',
        school: '',
        yearLevel: undefined,
        curriculum: undefined,
        status: 'ACTIVE' as const,
        availability_monday: false,
        availability_tuesday: false,
        availability_wednesday: false,
        availability_thursday: false,
        availability_friday: false,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
      };

      await act(async () => {
        await result.current.updateDetails(
          formData,
          { toAdd: [], toRemove: ['subject-1'] },
          { toAdd: [], toRemove: [] }
        );
      });

      expect(mockUseRemoveSubjectFromStudent().mutateAsync).toHaveBeenCalledWith({
        studentId: mockStudentId,
        subjectId: 'subject-1',
      });
    });

    it('should handle parent additions', async () => {
      const { result } = renderHookWithProviders(() =>
        useStudentMutations({ studentId: mockStudentId })
      );

      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: '',
        phone: '',
        school: '',
        yearLevel: undefined,
        curriculum: undefined,
        status: 'ACTIVE' as const,
        availability_monday: false,
        availability_tuesday: false,
        availability_wednesday: false,
        availability_thursday: false,
        availability_friday: false,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
      };

      await act(async () => {
        await result.current.updateDetails(
          formData,
          { toAdd: [], toRemove: [] },
          { toAdd: ['parent-1'], toRemove: [] }
        );
      });

      expect(mockUseAssignParentToStudent().mutateAsync).toHaveBeenCalledWith({
        studentId: mockStudentId,
        parentId: 'parent-1',
      });
    });

    it('should handle parent removals', async () => {
      const { result } = renderHookWithProviders(() =>
        useStudentMutations({ studentId: mockStudentId })
      );

      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: '',
        phone: '',
        school: '',
        yearLevel: undefined,
        curriculum: undefined,
        status: 'ACTIVE' as const,
        availability_monday: false,
        availability_tuesday: false,
        availability_wednesday: false,
        availability_thursday: false,
        availability_friday: false,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
      };

      await act(async () => {
        await result.current.updateDetails(
          formData,
          { toAdd: [], toRemove: [] },
          { toAdd: [], toRemove: ['parent-1'] }
        );
      });

      expect(mockUseRemoveParentFromStudent().mutateAsync).toHaveBeenCalledWith({
        studentId: mockStudentId,
        parentId: 'parent-1',
      });
    });

    it('should handle complex updates with all changes', async () => {
      const { result } = renderHookWithProviders(() =>
        useStudentMutations({ studentId: mockStudentId })
      );

      const formData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '+61412345678',
        school: 'New School',
        yearLevel: 11,
        curriculum: 'SACE' as const,
        status: 'ACTIVE' as const,
        availability_monday: true,
        availability_tuesday: true,
        availability_wednesday: true,
        availability_thursday: true,
        availability_friday: true,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
      };

      await act(async () => {
        await result.current.updateDetails(
          formData,
          { toAdd: ['subject-1'], toRemove: ['subject-2'] },
          { toAdd: ['parent-1'], toRemove: ['parent-2'] }
        );
      });

      expect(mockUseUpdateStudent().mutateAsync).toHaveBeenCalled();
      expect(mockUseAssignSubjectToStudent().mutateAsync).toHaveBeenCalled();
      expect(mockUseRemoveSubjectFromStudent().mutateAsync).toHaveBeenCalled();
      expect(mockUseAssignParentToStudent().mutateAsync).toHaveBeenCalled();
      expect(mockUseRemoveParentFromStudent().mutateAsync).toHaveBeenCalled();
    });

    it('should set isUpdatingDetails to true during update', async () => {
      let resolveUpdate: () => void;
      const updatePromise = new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      });

      (mockUseUpdateStudent().mutateAsync as jest.Mock).mockReturnValue(updatePromise);

      const { result } = renderHookWithProviders(() =>
        useStudentMutations({ studentId: mockStudentId })
      );

      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: '',
        phone: '',
        school: '',
        yearLevel: undefined,
        curriculum: undefined,
        status: 'ACTIVE' as const,
        availability_monday: false,
        availability_tuesday: false,
        availability_wednesday: false,
        availability_thursday: false,
        availability_friday: false,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
      };

      act(() => {
        result.current.updateDetails(
          formData,
          { toAdd: [], toRemove: [] },
          { toAdd: [], toRemove: [] }
        );
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

    it('should handle errors and show toast', async () => {
      const error = new Error('Update failed');
      (mockUseUpdateStudent().mutateAsync as jest.Mock).mockRejectedValue(error);

      const { result } = renderHookWithProviders(() =>
        useStudentMutations({ studentId: mockStudentId })
      );

      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        email: '',
        phone: '',
        school: '',
        yearLevel: undefined,
        curriculum: undefined,
        status: 'ACTIVE' as const,
        availability_monday: false,
        availability_tuesday: false,
        availability_wednesday: false,
        availability_thursday: false,
        availability_friday: false,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
      };

      await expect(
        act(async () => {
          await result.current.updateDetails(
            formData,
            { toAdd: [], toRemove: [] },
            { toAdd: [], toRemove: [] }
          );
        })
      ).rejects.toThrow('Update failed');
    });
  });

  describe('deleteStudent', () => {
    it('should delete student successfully', async () => {
      const { result } = renderHookWithProviders(() =>
        useStudentMutations({ studentId: mockStudentId, onSuccess: mockOnSuccess })
      );

      await act(async () => {
        await result.current.deleteStudent();
      });

      expect(mockUseDeleteStudent().mutateAsync).toHaveBeenCalledWith(mockStudentId);
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should set isDeleting to true during deletion', async () => {
      let resolveDelete: () => void;
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });

      (mockUseDeleteStudent().mutateAsync as jest.Mock).mockReturnValue(deletePromise);

      const { result } = renderHookWithProviders(() =>
        useStudentMutations({ studentId: mockStudentId })
      );

      act(() => {
        result.current.deleteStudent();
      });

      expect(result.current.isDeleting).toBe(true);

      await act(async () => {
        resolveDelete!();
        await deletePromise;
      });

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Delete failed');
      (mockUseDeleteStudent().mutateAsync as jest.Mock).mockRejectedValue(error);

      const { result } = renderHookWithProviders(() =>
        useStudentMutations({ studentId: mockStudentId })
      );

      await expect(
        act(async () => {
          await result.current.deleteStudent();
        })
      ).rejects.toThrow('Delete failed');
    });
  });
});
