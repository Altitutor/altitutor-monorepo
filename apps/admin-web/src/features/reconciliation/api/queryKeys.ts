/**
 * Query keys for reconciliation data
 */
export const reconciliationKeys = {
  all: ['reconciliation'] as const,
  lists: () => [...reconciliationKeys.all, 'list'] as const,
  uninvoicedSessions: () => [...reconciliationKeys.lists(), 'uninvoiced_sessions'] as const,
  orphanedInvoiceItems: () => [...reconciliationKeys.lists(), 'orphaned_invoice_items'] as const,
  unpaidInvoices: () => [...reconciliationKeys.lists(), 'unpaid_invoices'] as const,
  studentsWithoutClasses: () => [...reconciliationKeys.lists(), 'students_without_classes'] as const,
  unloggedSessions: () => [...reconciliationKeys.lists(), 'unlogged_sessions'] as const,
  unassignedClasses: () => [...reconciliationKeys.lists(), 'unassigned_classes'] as const,
  unreadMessages: () => [...reconciliationKeys.lists(), 'unread_messages'] as const,
};
