/**
 * Query keys for reconciliation data
 */
export const reconciliationKeys = {
  all: ['reconciliation'] as const,
  lists: () => [...reconciliationKeys.all, 'list'] as const,
  uninvoicedSessions: () => [...reconciliationKeys.lists(), 'uninvoiced_sessions'] as const,
  unpaidInvoices: () => [...reconciliationKeys.lists(), 'unpaid_invoices'] as const,
  unloggedSessions: () => [...reconciliationKeys.lists(), 'unlogged_sessions'] as const,
  unassignedClasses: () => [...reconciliationKeys.lists(), 'unassigned_classes'] as const,
  unrepliedMessages: () => [...reconciliationKeys.lists(), 'unreplied_messages'] as const,
  failedDeliveryMessages: () => [...reconciliationKeys.lists(), 'failed_delivery_messages'] as const,
  studentsWithoutClasses: () => [...reconciliationKeys.lists(), 'students_without_classes'] as const,
  studentsWithoutPaymentMethod: () => [...reconciliationKeys.lists(), 'students_without_payment_method'] as const,
  trialStudentsNotSignedUp: () => [...reconciliationKeys.lists(), 'trial_students_not_signed_up'] as const,
};
