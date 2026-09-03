import { useQuery } from '@tanstack/react-query';
import { reconciliationApi, getReconciliationTabCounts } from './reconciliation';
import { fetchFamilyCheckInsData } from './familyCheckIns';
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

export function useSessionBillingAdjustmentIssues() {
  return useQuery({
    queryKey: reconciliationKeys.sessionBillingAdjustments(),
    queryFn: () => reconciliationApi.getSessionBillingAdjustmentIssues(),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Sessions billed only on void invoices (re-invoicing may be required)
 */
export function useVoidInvoiceSessions() {
  return useQuery({
    queryKey: reconciliationKeys.voidInvoiceSessions(),
    queryFn: () => reconciliationApi.getVoidInvoiceSessions(),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
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
 * Get students without classes
 */
export function useStudentsWithoutClasses() {
  return useQuery({
    queryKey: reconciliationKeys.studentsWithoutClasses(),
    queryFn: () => reconciliationApi.getStudentsWithoutClasses(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get students without payment method
 */
export function useStudentsWithoutPaymentMethod() {
  return useQuery({
    queryKey: reconciliationKeys.studentsWithoutPaymentMethod(),
    queryFn: () => reconciliationApi.getStudentsWithoutPaymentMethod(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get trial students who haven't signed up
 */
export function useTrialStudentsNotSignedUp() {
  return useQuery({
    queryKey: reconciliationKeys.trialStudentsNotSignedUp(),
    queryFn: () => reconciliationApi.getTrialStudentsNotSignedUp(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get unassigned tasks
 */
export function useUnassignedTasks() {
  return useQuery({
    queryKey: reconciliationKeys.unassignedTasks(),
    queryFn: () => reconciliationApi.getUnassignedTasks(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Active projects with no project lead (reconciliation / operations).
 */
export function useProjectsWithNoLead() {
  return useQuery({
    queryKey: reconciliationKeys.projectsWithNoLead(),
    queryFn: () => reconciliationApi.getProjectsWithNoLead(),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Staff / student / parent last check-in summaries for the Family reconciliation tab.
 */
export function useFamilyCheckInsData() {
  return useQuery({
    queryKey: reconciliationKeys.familyCheckIns(),
    queryFn: () => fetchFamilyCheckInsData(),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

/**
 * Row counts per reconciliation tab (for navigation badges).
 */
export function useReconciliationTabCounts() {
  return useQuery({
    queryKey: reconciliationKeys.tabCounts(),
    queryFn: () => getReconciliationTabCounts(),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}
