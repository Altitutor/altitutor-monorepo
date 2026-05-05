import { renderHook, act } from '@testing-library/react';
import { useReconciliationModals } from '../useReconciliationModals';

describe('useReconciliationModals', () => {
  it('should initialize with all modals closed', () => {
    const { result } = renderHook(() => useReconciliationModals());

    expect(result.current.isStudentModalOpen).toBe(false);
    expect(result.current.isLogSessionModalOpen).toBe(false);
    expect(result.current.isInvoiceModalOpen).toBe(false);
    expect(result.current.isSessionModalOpen).toBe(false);
    expect(result.current.isClassModalOpen).toBe(false);
    expect(result.current.isAssignStaffModalOpen).toBe(false);
    expect(result.current.isEnrollModalOpen).toBe(false);
    expect(result.current.isStaffModalOpen).toBe(false);
    expect(result.current.selectedStaffId).toBe(null);
    expect(result.current.isProjectModalOpen).toBe(false);
    expect(result.current.selectedProjectId).toBe(null);
    expect(result.current.isParentModalOpen).toBe(false);
    expect(result.current.selectedParentId).toBe(null);
  });

  it('should open and close staff modal', () => {
    const { result } = renderHook(() => useReconciliationModals());

    act(() => {
      result.current.handleOpenStaff('staff-1');
    });

    expect(result.current.isStaffModalOpen).toBe(true);
    expect(result.current.selectedStaffId).toBe('staff-1');

    act(() => {
      result.current.handleCloseStaff();
    });

    expect(result.current.isStaffModalOpen).toBe(false);
    expect(result.current.selectedStaffId).toBe(null);
  });

  it('should open student modal', () => {
    const { result } = renderHook(() => useReconciliationModals());

    act(() => {
      result.current.handleOpenStudent('student-1');
    });

    expect(result.current.isStudentModalOpen).toBe(true);
    expect(result.current.selectedStudentId).toBe('student-1');
  });

  it('should close student modal', () => {
    const { result } = renderHook(() => useReconciliationModals());

    act(() => {
      result.current.handleOpenStudent('student-1');
    });

    act(() => {
      result.current.handleCloseStudent();
    });

    expect(result.current.isStudentModalOpen).toBe(false);
    expect(result.current.selectedStudentId).toBe(null);
  });

  it('should open log session modal with session and staff IDs', () => {
    const { result } = renderHook(() => useReconciliationModals());

    act(() => {
      result.current.handleLogSession('session-1', 'staff-1');
    });

    expect(result.current.isLogSessionModalOpen).toBe(true);
    expect(result.current.logSessionInitialSessionId).toBe('session-1');
    expect(result.current.logSessionInitialStaffId).toBe('staff-1');
  });

  it('should open log session modal without staff ID', () => {
    const { result } = renderHook(() => useReconciliationModals());

    act(() => {
      result.current.handleLogSession('session-1');
    });

    expect(result.current.isLogSessionModalOpen).toBe(true);
    expect(result.current.logSessionInitialSessionId).toBe('session-1');
    expect(result.current.logSessionInitialStaffId).toBeUndefined();
  });

  it('should close log session modal and reset state', () => {
    const { result } = renderHook(() => useReconciliationModals());

    act(() => {
      result.current.handleLogSession('session-1', 'staff-1');
    });

    act(() => {
      result.current.handleCloseLogSession();
    });

    expect(result.current.isLogSessionModalOpen).toBe(false);
    expect(result.current.logSessionInitialSessionId).toBeUndefined();
    expect(result.current.logSessionInitialStaffId).toBeUndefined();
  });

  it('should open assign staff modal', () => {
    const { result } = renderHook(() => useReconciliationModals());

    act(() => {
      result.current.handleAssignStaff('class-1');
    });

    expect(result.current.isAssignStaffModalOpen).toBe(true);
    expect(result.current.assignStaffClassId).toBe('class-1');
  });

  it('should open enroll modal with student and subject IDs', () => {
    const { result } = renderHook(() => useReconciliationModals());

    act(() => {
      result.current.handleAddClass('student-1', 'subject-1');
    });

    expect(result.current.isEnrollModalOpen).toBe(true);
    expect(result.current.enrollModalStudentId).toBe('student-1');
    expect(result.current.enrollModalSubjectId).toBe('subject-1');
  });

  it('should open and close project modal', () => {
    const { result } = renderHook(() => useReconciliationModals());

    act(() => {
      result.current.handleOpenProject('project-1');
    });

    expect(result.current.isProjectModalOpen).toBe(true);
    expect(result.current.selectedProjectId).toBe('project-1');

    act(() => {
      result.current.handleCloseProject();
    });

    expect(result.current.isProjectModalOpen).toBe(false);
    expect(result.current.selectedProjectId).toBe(null);
  });

  it('should open and close parent modal', () => {
    const { result } = renderHook(() => useReconciliationModals());

    act(() => {
      result.current.handleOpenParent('parent-1');
    });

    expect(result.current.isParentModalOpen).toBe(true);
    expect(result.current.selectedParentId).toBe('parent-1');

    act(() => {
      result.current.handleCloseParent();
    });

    expect(result.current.isParentModalOpen).toBe(false);
    expect(result.current.selectedParentId).toBe(null);
  });
});
