/**
 * Tests for useStaffMutations hook
 * Tests staff update and deletion mutations
 */

import { act, waitFor } from '@testing-library/react';
import { useStaffMutations } from '../useStaffMutations';
import {
  useUpdateStaff,
  useDeleteStaff,
  useAssignSubjectToStaff,
  useRemoveSubjectFromStaff,
} from '../useStaffQuery';
import { renderHookWithProviders } from '@/shared/test-utils';

// Mock dependencies
jest.mock('../useStaffQuery');

const mockUseUpdateStaff = useUpdateStaff as jest.MockedFunction<typeof useUpdateStaff>;
const mockUseDeleteStaff = useDeleteStaff as jest.MockedFunction<typeof useDeleteStaff>;
const mockUseAssignSubjectToStaff = useAssignSubjectToStaff as jest.MockedFunction<typeof useAssignSubjectToStaff>;
const mockUseRemoveSubjectFromStaff = useRemoveSubjectFromStaff as jest.MockedFunction<typeof useRemoveSubjectFromStaff>;

describe('useStaffMutations', () => {
  const mockStaffId = 'staff-1';
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseUpdateStaff.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    } as unknown as ReturnType<typeof useUpdateStaff>);

    mockUseDeleteStaff.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    } as unknown as ReturnType<typeof useDeleteStaff>);

    mockUseAssignSubjectToStaff.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    } as unknown as ReturnType<typeof useAssignSubjectToStaff>);

    mockUseRemoveSubjectFromStaff.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
    } as unknown as ReturnType<typeof useRemoveSubjectFromStaff>);
  });

  describe('updateDetails', () => {
    it('should update staff details successfully', async () => {
      const { result } = renderHookWithProviders(() =>
        useStaffMutations({ staffId: mockStaffId, onSuccess: mockOnSuccess })
      );

      const formData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phoneNumber: '+61412345678',
        role: 'TUTOR' as const,
        status: 'ACTIVE' as const,
        officeKeyNumber: 123,
        hasParkingRemote: 'VIRTUAL' as const,
        availability_monday: true,
        availability_tuesday: false,
        availability_wednesday: true,
        availability_thursday: false,
        availability_friday: true,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
        drafting_availability: true,
        trial_session_availability: true,
        subsidy_interview_availability: false,
      };

      await act(async () => {
        await result.current.updateDetails(formData, { toAdd: [], toRemove: [] });
      });

      expect(mockUseUpdateStaff().mutateAsync).toHaveBeenCalledWith({
        id: mockStaffId,
        data: expect.objectContaining({
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          role: 'TUTOR',
          status: 'ACTIVE',
        }),
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should handle subject additions', async () => {
      const { result } = renderHookWithProviders(() =>
        useStaffMutations({ staffId: mockStaffId })
      );

      const formData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: '',
        phoneNumber: '',
        role: 'TUTOR' as const,
        status: 'ACTIVE' as const,
        officeKeyNumber: null,
        hasParkingRemote: null,
        availability_monday: false,
        availability_tuesday: false,
        availability_wednesday: false,
        availability_thursday: false,
        availability_friday: false,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
        drafting_availability: false,
        trial_session_availability: false,
        subsidy_interview_availability: false,
      };

      await act(async () => {
        await result.current.updateDetails(formData, { toAdd: ['subject-1', 'subject-2'], toRemove: [] });
      });

      expect(mockUseAssignSubjectToStaff().mutateAsync).toHaveBeenCalledTimes(2);
      expect(mockUseAssignSubjectToStaff().mutateAsync).toHaveBeenCalledWith({
        staffId: mockStaffId,
        subjectId: 'subject-1',
      });
    });

    it('should handle subject removals', async () => {
      const { result } = renderHookWithProviders(() =>
        useStaffMutations({ staffId: mockStaffId })
      );

      const formData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: '',
        phoneNumber: '',
        role: 'TUTOR' as const,
        status: 'ACTIVE' as const,
        officeKeyNumber: null,
        hasParkingRemote: null,
        availability_monday: false,
        availability_tuesday: false,
        availability_wednesday: false,
        availability_thursday: false,
        availability_friday: false,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
        drafting_availability: false,
        trial_session_availability: false,
        subsidy_interview_availability: false,
      };

      await act(async () => {
        await result.current.updateDetails(formData, { toAdd: [], toRemove: ['subject-1'] });
      });

      expect(mockUseRemoveSubjectFromStaff().mutateAsync).toHaveBeenCalledWith({
        staffId: mockStaffId,
        subjectId: 'subject-1',
      });
    });

    it('should set isUpdatingDetails during update', async () => {
      let resolveUpdate: () => void;
      const updatePromise = new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      });

      (mockUseUpdateStaff().mutateAsync as jest.Mock).mockReturnValue(updatePromise);

      const { result } = renderHookWithProviders(() =>
        useStaffMutations({ staffId: mockStaffId })
      );

      const formData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: '',
        phoneNumber: '',
        role: 'TUTOR' as const,
        status: 'ACTIVE' as const,
        officeKeyNumber: null,
        hasParkingRemote: null,
        availability_monday: false,
        availability_tuesday: false,
        availability_wednesday: false,
        availability_thursday: false,
        availability_friday: false,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
        drafting_availability: false,
        trial_session_availability: false,
        subsidy_interview_availability: false,
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
      (mockUseUpdateStaff().mutateAsync as jest.Mock).mockRejectedValue(error);

      const { result } = renderHookWithProviders(() =>
        useStaffMutations({ staffId: mockStaffId })
      );

      const formData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: '',
        phoneNumber: '',
        role: 'TUTOR' as const,
        status: 'ACTIVE' as const,
        officeKeyNumber: null,
        hasParkingRemote: null,
        availability_monday: false,
        availability_tuesday: false,
        availability_wednesday: false,
        availability_thursday: false,
        availability_friday: false,
        availability_saturday_am: false,
        availability_saturday_pm: false,
        availability_sunday_am: false,
        availability_sunday_pm: false,
        drafting_availability: false,
        trial_session_availability: false,
        subsidy_interview_availability: false,
      };

      await expect(
        act(async () => {
          await result.current.updateDetails(formData, { toAdd: [], toRemove: [] });
        })
      ).rejects.toThrow('Update failed');
    });
  });

  describe('deleteStaff', () => {
    it('should delete staff successfully', async () => {
      const { result } = renderHookWithProviders(() =>
        useStaffMutations({ staffId: mockStaffId, onSuccess: mockOnSuccess })
      );

      await act(async () => {
        await result.current.deleteStaff();
      });

      expect(mockUseDeleteStaff().mutateAsync).toHaveBeenCalledWith(mockStaffId);
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should set isDeleting during deletion', async () => {
      let resolveDelete: () => void;
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });

      (mockUseDeleteStaff().mutateAsync as jest.Mock).mockReturnValue(deletePromise);

      const { result } = renderHookWithProviders(() =>
        useStaffMutations({ staffId: mockStaffId })
      );

      act(() => {
        result.current.deleteStaff();
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
      (mockUseDeleteStaff().mutateAsync as jest.Mock).mockRejectedValue(error);

      const { result } = renderHookWithProviders(() =>
        useStaffMutations({ staffId: mockStaffId })
      );

      await expect(
        act(async () => {
          await result.current.deleteStaff();
        })
      ).rejects.toThrow('Delete failed');
    });
  });
});
