import {
  useUninvoicedSessions,
  useUnpaidInvoices,
  useUnloggedSessions,
  useUnassignedClasses,
  useUnrepliedMessages,
  useFailedDeliveryMessages,
  useStudentsWithoutClasses,
  useStudentsWithoutPaymentMethod,
} from '../api/queries';

/**
 * Hook to aggregate all reconciliation queries and provide loading/error states
 */
export function useReconciliationData() {
  const uninvoicedSessions = useUninvoicedSessions();
  const unpaidInvoices = useUnpaidInvoices();
  const unloggedSessions = useUnloggedSessions();
  const unassignedClasses = useUnassignedClasses();
  const unrepliedMessages = useUnrepliedMessages();
  const failedDeliveryMessages = useFailedDeliveryMessages();
  const studentsWithoutClasses = useStudentsWithoutClasses();
  const studentsWithoutPaymentMethod = useStudentsWithoutPaymentMethod();

  const isLoading =
    uninvoicedSessions.isLoading ||
    unpaidInvoices.isLoading ||
    unloggedSessions.isLoading ||
    unassignedClasses.isLoading ||
    unrepliedMessages.isLoading ||
    failedDeliveryMessages.isLoading ||
    studentsWithoutClasses.isLoading ||
    studentsWithoutPaymentMethod.isLoading;

  const hasError =
    uninvoicedSessions.isError ||
    unpaidInvoices.isError ||
    unloggedSessions.isError ||
    unassignedClasses.isError ||
    unrepliedMessages.isError ||
    failedDeliveryMessages.isError ||
    studentsWithoutClasses.isError ||
    studentsWithoutPaymentMethod.isError;

  return {
    uninvoicedSessions,
    unpaidInvoices,
    unloggedSessions,
    unassignedClasses,
    unrepliedMessages,
    failedDeliveryMessages,
    studentsWithoutClasses,
    studentsWithoutPaymentMethod,
    isLoading,
    hasError,
  };
}
