import { act } from '@testing-library/react';
import { useAssignStaffMutation, useEnrollStudentMutation } from '../useReconciliationMutations';
import { classesApi } from '@/features/classes/api';
import { renderHookWithProviders } from '@/shared/test-utils';

// Mock the API and toast
jest.mock('@/features/classes/api');
jest.mock('@altitutor/ui', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const mockClassesApi = classesApi as jest.Mocked<typeof classesApi>;

describe('useAssignStaffMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClassesApi.assignStaff.mockResolvedValue({
      id: 'assignment-1',
      class_id: 'class-1',
      staff_id: 'staff-1',
      assigned_at: new Date().toISOString(),
      assigned_by: 'current-staff-1',
      unassigned_at: null,
      unassigned_by: null,
    } as any);
  });

  it('should call classesApi.assignStaff with correct parameters', async () => {
    const { result } = renderHookWithProviders(() => useAssignStaffMutation());

    const params = {
      staffId: 'staff-1',
      classId: 'class-1',
      assignedAt: new Date(),
      currentStaffId: 'current-staff-1',
    };

    await act(async () => {
      await result.current.mutateAsync(params);
    });

    expect(mockClassesApi.assignStaff).toHaveBeenCalledWith(
      'class-1',
      'staff-1',
      'current-staff-1'
    );
  });
});

describe('useEnrollStudentMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClassesApi.enrollStudent.mockResolvedValue({
      id: 'enrollment-1',
      class_id: 'class-1',
      student_id: 'student-1',
      enrolled_at: new Date().toISOString(),
      enrolled_by: 'current-staff-1',
      unenrolled_at: null,
      unenrolled_by: null,
    } as any);
  });

  it('should call classesApi.enrollStudent with correct parameters', async () => {
    const { result } = renderHookWithProviders(() => useEnrollStudentMutation());

    const params = {
      studentId: 'student-1',
      classId: 'class-1',
      enrolledAt: new Date(),
      staffId: 'current-staff-1',
    };

    await act(async () => {
      await result.current.mutateAsync(params);
    });

    expect(mockClassesApi.enrollStudent).toHaveBeenCalledWith(
      'class-1',
      'student-1',
      params.enrolledAt,
      'current-staff-1'
    );
  });
});
