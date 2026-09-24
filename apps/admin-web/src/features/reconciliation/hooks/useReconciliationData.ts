import {
  useUninvoicedSessions,
  useVoidInvoiceSessions,
  useUnpaidInvoices,
  useUnloggedSessions,
  useUnassignedClasses,
  useUnassignedTasks,
  useStudentsWithoutClasses,
  useStudentsWithoutPaymentMethod,
  useTrialStudentsNotSignedUp,
  useProjectsWithNoLead,
  useSessionBillingAdjustmentIssues,
} from '../api/queries';

function aggregateLoading(...flags: boolean[]) {
  return flags.some(Boolean);
}

function aggregateError(...flags: boolean[]) {
  return flags.some(Boolean);
}

export function useReconciliationFinancialData() {
  const sessionBillingAdjustments = useSessionBillingAdjustmentIssues();
  const uninvoicedSessions = useUninvoicedSessions();
  const voidInvoiceSessions = useVoidInvoiceSessions();
  const unpaidInvoices = useUnpaidInvoices();
  const studentsWithoutPaymentMethod = useStudentsWithoutPaymentMethod();

  return {
    uninvoicedSessions,
    voidInvoiceSessions,
    unpaidInvoices,
    studentsWithoutPaymentMethod,
    sessionBillingAdjustments,
    isLoading: aggregateLoading(
      uninvoicedSessions.isLoading,
      voidInvoiceSessions.isLoading,
      unpaidInvoices.isLoading,
      studentsWithoutPaymentMethod.isLoading,
      sessionBillingAdjustments.isLoading,
    ),
    hasError: aggregateError(
      uninvoicedSessions.isError,
      voidInvoiceSessions.isError,
      unpaidInvoices.isError,
      studentsWithoutPaymentMethod.isError,
      sessionBillingAdjustments.isError,
    ),
  };
}

export function useReconciliationSchedulingData() {
  const unloggedSessions = useUnloggedSessions();
  const unassignedClasses = useUnassignedClasses();
  const studentsWithoutClasses = useStudentsWithoutClasses();
  const trialStudentsNotSignedUp = useTrialStudentsNotSignedUp();

  return {
    unloggedSessions,
    unassignedClasses,
    studentsWithoutClasses,
    trialStudentsNotSignedUp,
    isLoading: aggregateLoading(
      unloggedSessions.isLoading,
      unassignedClasses.isLoading,
      studentsWithoutClasses.isLoading,
      trialStudentsNotSignedUp.isLoading,
    ),
    hasError: aggregateError(
      unloggedSessions.isError,
      unassignedClasses.isError,
      studentsWithoutClasses.isError,
      trialStudentsNotSignedUp.isError,
    ),
  };
}

export function useReconciliationOperationsData() {
  const unassignedTasks = useUnassignedTasks();
  const projectsWithNoLead = useProjectsWithNoLead();

  return {
    unassignedTasks,
    projectsWithNoLead,
    isLoading: aggregateLoading(unassignedTasks.isLoading, projectsWithNoLead.isLoading),
    hasError: aggregateError(unassignedTasks.isError, projectsWithNoLead.isError),
  };
}
