import { useMemo } from 'react';
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
} from '../types';

interface ReconciliationQueries {
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
}

/**
 * Hook to aggregate reconciliation items by category for empty state checks
 */
export function useReconciliationItems(queries: ReconciliationQueries) {
  return useMemo(() => {
    const financialItems = [
      ...(queries.uninvoicedSessions.data ?? []),
      ...(queries.voidInvoiceSessions.data ?? []),
      ...(queries.unpaidInvoices.data ?? []),
      ...(queries.studentsWithoutPaymentMethod.data ?? []),
    ];

    const schedulingItems = [
      ...(queries.unloggedSessions.data ?? []),
      ...(queries.unassignedClasses.data ?? []),
      ...(queries.studentsWithoutClasses.data ?? []),
      ...(queries.trialStudentsNotSignedUp.data ?? []),
    ];

    const operationsItems = [
      ...(queries.unassignedTasks.data ?? []),
      ...(queries.projectsWithoutLead?.data ?? []),
    ];

    const communicationItems = [
      ...(queries.failedDeliveryMessages.data ?? []),
    ];

    const trialItems = [
      ...(queries.trialStudentsNotSignedUp.data ?? []),
    ];

    return {
      financialItems,
      schedulingItems,
      communicationItems,
      trialItems,
      operationsItems,
      hasAnyItems:
        financialItems.length > 0 ||
        schedulingItems.length > 0 ||
        communicationItems.length > 0 ||
        operationsItems.length > 0,
    };
  }, [
    queries.uninvoicedSessions.data,
    queries.voidInvoiceSessions.data,
    queries.unpaidInvoices.data,
    queries.unloggedSessions.data,
    queries.unassignedClasses.data,
    queries.unassignedTasks.data,
    queries.failedDeliveryMessages.data,
    queries.studentsWithoutClasses.data,
    queries.studentsWithoutPaymentMethod.data,
    queries.trialStudentsNotSignedUp.data,
    queries.projectsWithoutLead?.data,
  ]);
}
