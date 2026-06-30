import type { QueryClient } from '@tanstack/react-query';

import { invoicesKeys } from '@/features/billing/hooks/useInvoicesQuery';
import { classesKeys } from '@/features/classes/hooks/useClassesQuery';
import { projectKeys } from '@/features/projects/api/queryKeys';
import { reconciliationKeys } from '@/features/reconciliation/api/queryKeys';
import { sessionsKeys } from '@/features/sessions/hooks/useSessionsQuery';
import { staffKeys } from '@/features/staff/hooks/useStaffQuery';
import { studentsKeys } from '@/features/students/hooks/useStudentsQuery';

const invalidate = (queryClient: QueryClient, queryKey: readonly unknown[]) =>
  queryClient.invalidateQueries({ queryKey });

export function invalidateStudentDetail(queryClient: QueryClient, studentId: string) {
  return invalidate(queryClient, studentsKeys.detail(studentId));
}

export function invalidateStudentClassSurfaces(queryClient: QueryClient, studentId: string) {
  return Promise.all([
    invalidateStudentDetail(queryClient, studentId),
    invalidate(queryClient, ['students', studentId, 'classes']),
    invalidate(queryClient, ['students', studentId, 'allClasses']),
  ]);
}

export function invalidateClassDetail(queryClient: QueryClient, classId: string) {
  return invalidate(queryClient, classesKeys.detail(classId));
}

export function invalidateClassListSurfaces(queryClient: QueryClient) {
  return Promise.all([
    invalidate(queryClient, classesKeys.minimal()),
    invalidate(queryClient, classesKeys.withDetails()),
  ]);
}

export function invalidateClassSurfaces(queryClient: QueryClient, classId: string) {
  return Promise.all([
    invalidateClassDetail(queryClient, classId),
    invalidateClassListSurfaces(queryClient),
  ]);
}

export function invalidateStaffDetail(queryClient: QueryClient, staffId: string) {
  return invalidate(queryClient, staffKeys.detail(staffId));
}

export function invalidateStaffListSurfaces(queryClient: QueryClient) {
  return invalidate(queryClient, staffKeys.all);
}

export function invalidateStaffSurfaces(queryClient: QueryClient, staffId: string) {
  return Promise.all([
    invalidateStaffDetail(queryClient, staffId),
    invalidateStaffListSurfaces(queryClient),
  ]);
}

export function invalidateSessionDetail(queryClient: QueryClient, sessionId: string) {
  return invalidate(queryClient, sessionsKeys.detail(sessionId));
}

export function invalidateSessionListSurfaces(queryClient: QueryClient) {
  return invalidate(queryClient, sessionsKeys.all);
}

export function invalidateSessionSurfaces(queryClient: QueryClient, sessionId: string) {
  return Promise.all([
    invalidateSessionDetail(queryClient, sessionId),
    invalidate(queryClient, sessionsKeys.withDetails()),
  ]);
}

export function invalidateStudentSessionSurfaces(queryClient: QueryClient, studentId: string) {
  return Promise.all([
    invalidate(queryClient, sessionsKeys.forStudent(studentId)),
    invalidate(queryClient, sessionsKeys.withDetails()),
  ]);
}

export function invalidateInvoiceDetail(queryClient: QueryClient, invoiceId: string) {
  return Promise.all([
    invalidate(queryClient, invoicesKeys.detail(invoiceId)),
    invalidate(queryClient, ['invoice-stripe-details', invoiceId]),
    invalidate(queryClient, [...invoicesKeys.details(), invoiceId, 'credit-notes']),
  ]);
}

export function invalidateInvoiceSurfaces(queryClient: QueryClient, invoiceId: string) {
  return Promise.all([
    invalidateInvoiceDetail(queryClient, invoiceId),
    invalidate(queryClient, invoicesKeys.lists()),
  ]);
}

export function invalidateReconciliationSurfaces(queryClient: QueryClient) {
  return invalidate(queryClient, reconciliationKeys.all);
}

export function invalidateReconciliationProjectSurfaces(queryClient: QueryClient) {
  return Promise.all([
    invalidateReconciliationSurfaces(queryClient),
    invalidate(queryClient, projectKeys.all),
  ]);
}

export function invalidateProjectListSurfaces(queryClient: QueryClient) {
  return invalidate(queryClient, projectKeys.lists());
}

export function invalidateProjectDetailSurfaces(queryClient: QueryClient, projectId: string) {
  return Promise.all([
    invalidateProjectListSurfaces(queryClient),
    invalidate(queryClient, projectKeys.detail(projectId)),
    invalidate(queryClient, ['tasks']),
    invalidate(queryClient, ['notes']),
  ]);
}

export function invalidateProjectRemovalSurfaces(queryClient: QueryClient) {
  return Promise.all([
    invalidateProjectListSurfaces(queryClient),
    invalidate(queryClient, ['tasks']),
    invalidate(queryClient, ['notes']),
  ]);
}

export function invalidateCheckInSurfaces(queryClient: QueryClient) {
  return Promise.all([
    invalidateSessionListSurfaces(queryClient),
    invalidate(queryClient, reconciliationKeys.familyCheckIns()),
  ]);
}

export function invalidateUnloggedSessionSurfaces(queryClient: QueryClient) {
  return Promise.all([
    invalidate(queryClient, reconciliationKeys.unloggedSessions()),
    invalidate(queryClient, reconciliationKeys.familyCheckIns()),
  ]);
}

export function invalidateTaskAssignmentSurfaces(queryClient: QueryClient) {
  return invalidate(queryClient, reconciliationKeys.unassignedTasks());
}

export function invalidateInvoiceReconciliationSurfaces(queryClient: QueryClient) {
  return Promise.all([
    invalidate(queryClient, reconciliationKeys.uninvoicedSessions()),
    invalidate(queryClient, reconciliationKeys.voidInvoiceSessions()),
  ]);
}

export function invalidateUnpaidInvoiceReconciliationSurfaces(queryClient: QueryClient) {
  return invalidate(queryClient, reconciliationKeys.unpaidInvoices());
}

export function invalidateSessionInvoiceSurfaces(queryClient: QueryClient) {
  return Promise.all([
    invalidateSessionListSurfaces(queryClient),
    invalidate(queryClient, reconciliationKeys.uninvoicedSessions()),
  ]);
}
