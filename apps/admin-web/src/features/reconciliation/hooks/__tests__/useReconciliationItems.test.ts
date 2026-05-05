import { renderHook } from '@testing-library/react';
import { useReconciliationItems } from '../useReconciliationItems';
import type {
  UninvoicedSession,
  VoidInvoiceSession,
  UnpaidInvoice,
  UnloggedSession,
  UnassignedClass,
  UnassignedTask,
  FailedDeliveryMessage,
  StudentWithoutClasses,
  StudentWithoutPaymentMethod,
  TrialStudentNotSignedUp,
  ProjectWithoutLead,
} from '../../types';

type ReconciliationQueries = {
  uninvoicedSessions: { data?: UninvoicedSession[] };
  voidInvoiceSessions: { data?: VoidInvoiceSession[] };
  unpaidInvoices: { data?: UnpaidInvoice[] };
  unloggedSessions: { data?: UnloggedSession[] };
  unassignedClasses: { data?: UnassignedClass[] };
  unassignedTasks: { data?: UnassignedTask[] };
  failedDeliveryMessages: { data?: FailedDeliveryMessage[] };
  studentsWithoutClasses: { data?: StudentWithoutClasses[] };
  studentsWithoutPaymentMethod: { data?: StudentWithoutPaymentMethod[] };
  trialStudentsNotSignedUp: { data?: TrialStudentNotSignedUp[] };
  projectsWithoutLead?: { data?: ProjectWithoutLead[] };
};

const createMockQueries = (overrides?: Partial<ReconciliationQueries>): ReconciliationQueries => ({
  uninvoicedSessions: { data: [] as UninvoicedSession[] },
  voidInvoiceSessions: { data: [] as VoidInvoiceSession[] },
  unpaidInvoices: { data: [] as UnpaidInvoice[] },
  unloggedSessions: { data: [] as UnloggedSession[] },
  unassignedClasses: { data: [] as UnassignedClass[] },
  unassignedTasks: { data: [] as UnassignedTask[] },
  failedDeliveryMessages: { data: [] as FailedDeliveryMessage[] },
  studentsWithoutClasses: { data: [] as StudentWithoutClasses[] },
  studentsWithoutPaymentMethod: { data: [] as StudentWithoutPaymentMethod[] },
  trialStudentsNotSignedUp: { data: [] as TrialStudentNotSignedUp[] },
  projectsWithoutLead: { data: [] },
  ...overrides,
});

describe('useReconciliationItems', () => {
  it('should aggregate financial items correctly', () => {
    const queries = createMockQueries({
      uninvoicedSessions: { data: [{ sessions_students_id: '1' } as UninvoicedSession] },
      voidInvoiceSessions: { data: [{ sessions_students_id: '2' } as VoidInvoiceSession] },
      unpaidInvoices: { data: [{ id: '1' } as UnpaidInvoice] },
      studentsWithoutPaymentMethod: { data: [{ student_id: '1' } as StudentWithoutPaymentMethod] },
    });

    const { result } = renderHook(() => useReconciliationItems(queries));

    expect(result.current.financialItems).toHaveLength(4);
    expect(result.current.hasAnyItems).toBe(true);
  });

  it('should aggregate scheduling items correctly', () => {
    const queries = createMockQueries({
      unloggedSessions: { data: [{ session_id: '1' } as UnloggedSession] },
      unassignedClasses: { data: [{ class_id: '1', class_display_name: 'Math' } as UnassignedClass] },
      studentsWithoutClasses: { data: [{ student_id: '1' } as StudentWithoutClasses] },
      trialStudentsNotSignedUp: { data: [{ student_id: '1' } as TrialStudentNotSignedUp] },
    });

    const { result } = renderHook(() => useReconciliationItems(queries));

    expect(result.current.schedulingItems).toHaveLength(4);
    expect(result.current.hasAnyItems).toBe(true);
  });

  it('should aggregate operations items correctly', () => {
    const queries = createMockQueries({
      unassignedTasks: { data: [{ id: '1' } as UnassignedTask] },
    });

    const { result } = renderHook(() => useReconciliationItems(queries));

    expect(result.current.operationsItems).toHaveLength(1);
    expect(result.current.hasAnyItems).toBe(true);
  });

  it('should aggregate communication items correctly', () => {
    const queries = createMockQueries({
      failedDeliveryMessages: { data: [{ message_id: '1' } as FailedDeliveryMessage] },
    });

    const { result } = renderHook(() => useReconciliationItems(queries));

    expect(result.current.communicationItems).toHaveLength(1);
    expect(result.current.hasAnyItems).toBe(true);
  });

  it('should aggregate trial items correctly', () => {
    const queries = createMockQueries({
      trialStudentsNotSignedUp: { data: [{ student_id: '1' } as TrialStudentNotSignedUp] },
    });

    const { result } = renderHook(() => useReconciliationItems(queries));

    expect(result.current.trialItems).toHaveLength(1);
    expect(result.current.hasAnyItems).toBe(true);
  });

  it('should aggregate operations items with projects without lead', () => {
    const queries = createMockQueries({
      projectsWithoutLead: { data: [{ id: 'p1' } as ProjectWithoutLead] },
    });

    const { result } = renderHook(() => useReconciliationItems(queries));

    expect(result.current.operationsItems).toHaveLength(1);
    expect(result.current.hasAnyItems).toBe(true);
  });

  it('should return hasAnyItems false when all arrays are empty', () => {
    const queries = createMockQueries();

    const { result } = renderHook(() => useReconciliationItems(queries));

    expect(result.current.financialItems).toHaveLength(0);
    expect(result.current.schedulingItems).toHaveLength(0);
    expect(result.current.communicationItems).toHaveLength(0);
    expect(result.current.trialItems).toHaveLength(0);
    expect(result.current.operationsItems).toHaveLength(0);
    expect(result.current.hasAnyItems).toBe(false);
  });

  it('should handle undefined data arrays', () => {
    const queries: ReconciliationQueries = {
      uninvoicedSessions: { data: undefined },
      voidInvoiceSessions: { data: undefined },
      unpaidInvoices: { data: undefined },
      unloggedSessions: { data: undefined },
      unassignedClasses: { data: undefined },
      unassignedTasks: { data: undefined },
      failedDeliveryMessages: { data: undefined },
      studentsWithoutClasses: { data: undefined },
      studentsWithoutPaymentMethod: { data: undefined },
      trialStudentsNotSignedUp: { data: undefined },
      projectsWithoutLead: { data: undefined },
    };

    const { result } = renderHook(() => useReconciliationItems(queries));

    expect(result.current.financialItems).toHaveLength(0);
    expect(result.current.schedulingItems).toHaveLength(0);
    expect(result.current.communicationItems).toHaveLength(0);
    expect(result.current.trialItems).toHaveLength(0);
    expect(result.current.operationsItems).toHaveLength(0);
    expect(result.current.hasAnyItems).toBe(false);
  });
});
