/**
 * Tests for useBlockoutForm hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useBlockoutForm } from '../useBlockoutForm';
import { blockoutsApi } from '../../api/blockouts';
import { useToast } from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';

// Mock dependencies
jest.mock('../../api/blockouts', () => ({
  blockoutsApi: {
    createBlockout: jest.fn(),
    updateBlockout: jest.fn(),
    deleteBlockout: jest.fn(),
  },
}));

jest.mock('@altitutor/ui', () => ({
  useToast: jest.fn(),
}));

jest.mock('../../utils/dateTimeHelpers', () => ({
  dateToAdelaideMidnightUTC: jest.fn((date: string) => `${date}T00:00:00Z`),
  dateToAdelaideEndOfDayUTC: jest.fn((date: string) => `${date}T23:59:59Z`),
  utcToAdelaideDate: jest.fn((utc: string) => utc.split('T')[0]),
  getTodayAdelaideDate: jest.fn(() => '2024-01-15'),
}));

const mockBlockoutsApi = blockoutsApi as jest.Mocked<typeof blockoutsApi>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

describe('useBlockoutForm', () => {
  const mockToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: mockToast } as unknown as ReturnType<typeof useToast>);
  });

  describe('initial state', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useBlockoutForm());

      expect(result.current.staffId).toBe('');
      expect(result.current.startDate).toBe('2024-01-15');
      expect(result.current.endDate).toBe('2024-01-15');
      expect(result.current.reason).toBe('');
      expect(result.current.saving).toBe(false);
      expect(result.current.deleting).toBe(null);
    });
  });

  describe('form setters', () => {
    it('should update staffId', () => {
      const { result } = renderHook(() => useBlockoutForm());

      act(() => {
        result.current.setStaffId('staff-1');
      });

      expect(result.current.staffId).toBe('staff-1');
    });

    it('should update startDate', () => {
      const { result } = renderHook(() => useBlockoutForm());

      act(() => {
        result.current.setStartDate('2024-01-20');
      });

      expect(result.current.startDate).toBe('2024-01-20');
    });

    it('should update endDate', () => {
      const { result } = renderHook(() => useBlockoutForm());

      act(() => {
        result.current.setEndDate('2024-01-25');
      });

      expect(result.current.endDate).toBe('2024-01-25');
    });

    it('should update reason', () => {
      const { result } = renderHook(() => useBlockoutForm());

      act(() => {
        result.current.setReason('Holiday');
      });

      expect(result.current.reason).toBe('Holiday');
    });
  });

  describe('resetForm', () => {
    it('should reset form to initial state', () => {
      const { result } = renderHook(() => useBlockoutForm());

      act(() => {
        result.current.setStaffId('staff-1');
        result.current.setStartDate('2024-01-20');
        result.current.setEndDate('2024-01-25');
        result.current.setReason('Holiday');
      });

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.staffId).toBe('');
      expect(result.current.startDate).toBe('2024-01-15');
      expect(result.current.endDate).toBe('2024-01-15');
      expect(result.current.reason).toBe('');
    });
  });

  describe('loadBlockout', () => {
    it('should load blockout data into form', () => {
      const { result } = renderHook(() => useBlockoutForm());

      const blockout: Tables<'booking_staff_unavailability'> = {
        id: 'blockout-1',
        staff_id: 'staff-1',
        start_at: '2024-01-20T00:00:00Z',
        end_at: '2024-01-25T23:59:59Z',
        reason: 'Holiday',
        created_at: new Date().toISOString(),
        created_by: null,
      };

      act(() => {
        result.current.loadBlockout(blockout);
      });

      expect(result.current.staffId).toBe('staff-1');
      expect(result.current.startDate).toBe('2024-01-20');
      expect(result.current.endDate).toBe('2024-01-25');
      expect(result.current.reason).toBe('Holiday');
    });
  });

  describe('validateForm', () => {
    it('should return null when form is valid', () => {
      const { result } = renderHook(() => useBlockoutForm());

      act(() => {
        result.current.setStaffId('staff-1');
        result.current.setStartDate('2024-01-15');
        result.current.setEndDate('2024-01-20');
      });

      const validationError = result.current.validateForm();
      expect(validationError).toBeNull();
    });

    it('should return error when staffId is missing', () => {
      const { result } = renderHook(() => useBlockoutForm());

      act(() => {
        result.current.setStartDate('2024-01-15');
        result.current.setEndDate('2024-01-20');
      });

      const validationError = result.current.validateForm();
      expect(validationError).toBe('Please select a staff member');
    });

    it('should return error when endDate is before startDate', () => {
      const { result } = renderHook(() => useBlockoutForm());

      act(() => {
        result.current.setStaffId('staff-1');
        result.current.setStartDate('2024-01-20');
        result.current.setEndDate('2024-01-15');
      });

      const validationError = result.current.validateForm();
      expect(validationError).toBe('End date must be on or after start date');
    });

    it('should allow same start and end date', () => {
      const { result } = renderHook(() => useBlockoutForm());

      act(() => {
        result.current.setStaffId('staff-1');
        result.current.setStartDate('2024-01-15');
        result.current.setEndDate('2024-01-15');
      });

      const validationError = result.current.validateForm();
      expect(validationError).toBeNull();
    });
  });

  describe('createBlockout', () => {
    it('should create blockout successfully', async () => {
      const mockBlockout = {
        id: 'blockout-1',
        staff_id: 'staff-1',
        start_at: '2024-01-15T00:00:00Z',
        end_at: '2024-01-15T23:59:59Z',
        reason: 'Holiday',
      };

      mockBlockoutsApi.createBlockout.mockResolvedValue(mockBlockout as Awaited<ReturnType<typeof blockoutsApi.createBlockout>>);

      const { result } = renderHook(() => useBlockoutForm());

      act(() => {
        result.current.setStaffId('staff-1');
        result.current.setStartDate('2024-01-15');
        result.current.setEndDate('2024-01-15');
        result.current.setReason('Holiday');
      });

      await act(async () => {
        await result.current.createBlockout();
      });

      expect(mockBlockoutsApi.createBlockout).toHaveBeenCalledWith({
        staff_id: 'staff-1',
        start_at: '2024-01-15T00:00:00Z',
        end_at: '2024-01-15T23:59:59Z',
        reason: 'Holiday',
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Blockout created successfully',
        });
      });

      expect(result.current.staffId).toBe('');
      expect(result.current.reason).toBe('');
    });

    it('should show validation error when form is invalid', async () => {
      const { result } = renderHook(() => useBlockoutForm());

      await act(async () => {
        await result.current.createBlockout();
      });

      expect(mockBlockoutsApi.createBlockout).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Validation Error',
        description: 'Please select a staff member',
        variant: 'destructive',
      });
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockBlockoutsApi.createBlockout.mockRejectedValue(error);

      const { result } = renderHook(() => useBlockoutForm());

      act(() => {
        result.current.setStaffId('staff-1');
        result.current.setStartDate('2024-01-15');
        result.current.setEndDate('2024-01-15');
      });

      await act(async () => {
        await expect(result.current.createBlockout()).rejects.toThrow('API Error');
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'API Error',
          variant: 'destructive',
        });
      });
    });

    it('should call onSuccess callback after successful creation', async () => {
      const onSuccess = jest.fn();
      mockBlockoutsApi.createBlockout.mockResolvedValue({} as Awaited<ReturnType<typeof blockoutsApi.createBlockout>>);

      const { result } = renderHook(() => useBlockoutForm({ onSuccess }));

      act(() => {
        result.current.setStaffId('staff-1');
        result.current.setStartDate('2024-01-15');
        result.current.setEndDate('2024-01-15');
      });

      await act(async () => {
        await result.current.createBlockout();
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('updateBlockout', () => {
    it('should update blockout successfully', async () => {
      mockBlockoutsApi.updateBlockout.mockResolvedValue({} as Awaited<ReturnType<typeof blockoutsApi.updateBlockout>>);

      const { result } = renderHook(() => useBlockoutForm());

      act(() => {
        result.current.setStaffId('staff-1'); // Required for validation
        result.current.setStartDate('2024-01-20');
        result.current.setEndDate('2024-01-25');
        result.current.setReason('Updated reason');
      });

      await act(async () => {
        await result.current.updateBlockout('blockout-1');
      });

      expect(mockBlockoutsApi.updateBlockout).toHaveBeenCalledWith('blockout-1', {
        start_at: '2024-01-20T00:00:00Z',
        end_at: '2024-01-25T23:59:59Z',
        reason: 'Updated reason',
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Blockout updated successfully',
        });
      });
    });

    it('should show validation error when form is invalid', async () => {
      const { result } = renderHook(() => useBlockoutForm());

      await act(async () => {
        await result.current.updateBlockout('blockout-1');
      });

      expect(mockBlockoutsApi.updateBlockout).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Validation Error',
        description: 'Please select a staff member',
        variant: 'destructive',
      });
    });
  });

  describe('deleteBlockout', () => {
    beforeEach(() => {
      // Mock window.confirm
      window.confirm = jest.fn(() => true);
    });

    it('should delete blockout when confirmed', async () => {
      mockBlockoutsApi.deleteBlockout.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBlockoutForm());

      await act(async () => {
        await result.current.deleteBlockout('blockout-1');
      });

      expect(mockBlockoutsApi.deleteBlockout).toHaveBeenCalledWith('blockout-1');
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this blockout?');

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Blockout deleted successfully',
        });
      });
    });

    it('should not delete when user cancels confirmation', async () => {
      window.confirm = jest.fn(() => false);

      const { result } = renderHook(() => useBlockoutForm());

      await act(async () => {
        await result.current.deleteBlockout('blockout-1');
      });

      expect(mockBlockoutsApi.deleteBlockout).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Delete failed');
      mockBlockoutsApi.deleteBlockout.mockRejectedValue(error);
      window.confirm = jest.fn(() => true);

      const { result } = renderHook(() => useBlockoutForm());

      await act(async () => {
        await result.current.deleteBlockout('blockout-1');
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Delete failed',
          variant: 'destructive',
        });
      });
    });
  });
});
