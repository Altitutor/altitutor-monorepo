import { useQuery } from '@tanstack/react-query';
import { reconciliationApi } from './reconciliation';
import { reconciliationKeys } from './queryKeys';

/**
 * Get uninvoiced sessions
 */
export function useUninvoicedSessions() {
  return useQuery({
    queryKey: reconciliationKeys.uninvoicedSessions(),
    queryFn: () => reconciliationApi.getUninvoicedSessions(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get orphaned invoice items
 */
export function useOrphanedInvoiceItems() {
  return useQuery({
    queryKey: reconciliationKeys.orphanedInvoiceItems(),
    queryFn: () => reconciliationApi.getOrphanedInvoiceItems(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get unpaid invoices
 */
export function useUnpaidInvoices() {
  return useQuery({
    queryKey: reconciliationKeys.unpaidInvoices(),
    queryFn: () => reconciliationApi.getUnpaidInvoices(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get unlogged sessions
 */
export function useUnloggedSessions() {
  return useQuery({
    queryKey: reconciliationKeys.unloggedSessions(),
    queryFn: () => reconciliationApi.getUnloggedSessions(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get unassigned classes
 */
export function useUnassignedClasses() {
  return useQuery({
    queryKey: reconciliationKeys.unassignedClasses(),
    queryFn: () => reconciliationApi.getUnassignedClasses(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get unread messages
 */
export function useUnreadMessages() {
  return useQuery({
    queryKey: reconciliationKeys.unreadMessages(),
    queryFn: () => reconciliationApi.getUnreadMessages(),
    staleTime: 1000 * 60 * 1, // 1 minute (messages change frequently)
    gcTime: 1000 * 60 * 3, // 3 minutes
  });
}
