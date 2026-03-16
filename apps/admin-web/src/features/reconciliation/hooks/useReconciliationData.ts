import {
  useUninvoicedSessions,
  useUnpaidInvoices,
  useUnloggedSessions,
  useUnassignedClasses,
  useUnassignedTasks,
  useFailedDeliveryMessages,
  useStudentsWithoutClasses,
  useStudentsWithoutPaymentMethod,
  useTrialStudentsNotSignedUp,
} from '../api/queries';

/**
 * Hook to aggregate all reconciliation queries and provide loading/error states
 */
export function useReconciliationData() {
  const uninvoicedSessions = useUninvoicedSessions();
  const unpaidInvoices = useUnpaidInvoices();
  const unloggedSessions = useUnloggedSessions();
  const unassignedClasses = useUnassignedClasses();
  const unassignedTasks = useUnassignedTasks();
  const failedDeliveryMessages = useFailedDeliveryMessages();
  const studentsWithoutClasses = useStudentsWithoutClasses();
  const studentsWithoutPaymentMethod = useStudentsWithoutPaymentMethod();
  const trialStudentsNotSignedUp = useTrialStudentsNotSignedUp();

  const isLoading =
    uninvoicedSessions.isLoading ||
    unpaidInvoices.isLoading ||
    unloggedSessions.isLoading ||
    unassignedClasses.isLoading ||
    unassignedTasks.isLoading ||
    failedDeliveryMessages.isLoading ||
    studentsWithoutClasses.isLoading ||
    studentsWithoutPaymentMethod.isLoading ||
    trialStudentsNotSignedUp.isLoading;

  const hasError =
    uninvoicedSessions.isError ||
    unpaidInvoices.isError ||
    unloggedSessions.isError ||
    unassignedClasses.isError ||
    unassignedTasks.isError ||
    failedDeliveryMessages.isError ||
    studentsWithoutClasses.isError ||
    studentsWithoutPaymentMethod.isError ||
    trialStudentsNotSignedUp.isError;

  return {
    uninvoicedSessions,
    unpaidInvoices,
    unloggedSessions,
    unassignedClasses,
    unassignedTasks,
    failedDeliveryMessages,
    studentsWithoutClasses,
    studentsWithoutPaymentMethod,
    trialStudentsNotSignedUp,
    isLoading,
    hasError,
  };
}
