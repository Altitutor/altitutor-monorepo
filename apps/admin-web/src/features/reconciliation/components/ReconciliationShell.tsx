'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useQueryClient } from '@tanstack/react-query';
import { reconciliationKeys } from '../api/queryKeys';
import { useReconciliationTabCounts } from '../api/queries';
import { projectKeys } from '@/features/projects/api/queryKeys';
import { ReconciliationHandlersProvider } from './ReconciliationActions';
import {
  useReconciliationModals,
  useAssignStaffMutation,
  useEnrollStudentMutation,
} from '../hooks';
import { useCurrentStaff } from '@/shared/hooks';
import { ViewStudentModal } from '@/features/students';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { LogSessionModal } from '@/features/tutor-logs';
import { ViewInvoiceModal } from '@/features/billing';
import { SessionModal } from '@/features/sessions';
import { ViewStaffModal } from '@/features/staff';
import { ViewClassModal } from '@/features/classes';
import { EditProjectDialog } from '@/features/projects/components/EditProjectDialog';
import { AssignStaffModalWrapper } from './AssignStaffModalWrapper';
import { EnrollStudentModalWrapper } from './EnrollStudentModalWrapper';

const NAV = [
  { segment: 'financial', href: '/reconciliation/financial', label: 'Financial' },
  { segment: 'scheduling', href: '/reconciliation/scheduling', label: 'Scheduling' },
  { segment: 'communication', href: '/reconciliation/communication', label: 'Communication' },
  { segment: 'operations', href: '/reconciliation/operations', label: 'Operations' },
  { segment: 'family', href: '/reconciliation/family', label: 'Family' },
] as const;

function tabCountForSegment(
  segment: (typeof NAV)[number]['segment'],
  counts: { financial: number; scheduling: number; communication: number; operations: number } | undefined
): number | undefined {
  if (segment === 'family') return undefined;
  if (!counts) return undefined;
  if (segment === 'financial') return counts.financial;
  if (segment === 'scheduling') return counts.scheduling;
  if (segment === 'communication') return counts.communication;
  return counts.operations;
}

export function ReconciliationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  const tabCounts = useReconciliationTabCounts();
  const modals = useReconciliationModals();
  const assignStaffMutation = useAssignStaffMutation();
  const enrollStudentMutation = useEnrollStudentMutation();

  const handleCloseLogSession = () => {
    modals.handleCloseLogSession();
    queryClient.invalidateQueries({ queryKey: reconciliationKeys.unloggedSessions() });
    void queryClient.invalidateQueries({ queryKey: reconciliationKeys.familyCheckIns() });
  };

  const handleCloseStudent = () => {
    modals.handleCloseStudent();
    queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
  };

  const handleCloseClass = () => {
    modals.handleCloseClass();
    queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
  };

  const handleCloseStaff = () => {
    modals.handleCloseStaff();
    queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
  };

  const handleCloseProject = () => {
    modals.handleCloseProject();
    queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
    queryClient.invalidateQueries({ queryKey: projectKeys.all });
  };

  const handleCloseParent = () => {
    modals.handleCloseParent();
    queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
  };

  const handleAssignStaff = async (params: {
    staffId: string;
    classId: string;
    assignedAt: Date;
    currentStaffId: string;
  }) => {
    await assignStaffMutation.mutateAsync(params);
  };

  const handleEnrollStudent = async (params: {
    studentId: string;
    classId: string;
    enrolledAt: Date;
    staffId: string;
  }) => {
    await enrollStudentMutation.mutateAsync(params);
  };

  const counts = tabCounts.data;
  const totalItems =
    counts !== undefined
      ? counts.financial + counts.scheduling + counts.communication + counts.operations
      : undefined;

  const formatBadge = (segment: (typeof NAV)[number]['segment']): string | null => {
    if (segment === 'family') return null;
    if (tabCounts.isPending) return '…';
    if (tabCounts.isError) return '—';
    const n = tabCountForSegment(segment, counts);
    return n === undefined ? '—' : String(n);
  };

  return (
    <ReconciliationHandlersProvider
      handlers={{
        onOpenStudent: modals.handleOpenStudent,
        onLogSession: modals.handleLogSession,
        onOpenInvoice: modals.handleOpenInvoice,
        onOpenSession: modals.handleOpenSession,
        onOpenClass: modals.handleOpenClass,
        onOpenStaff: modals.handleOpenStaff,
        onOpenParent: modals.handleOpenParent,
        onOpenProject: modals.handleOpenProject,
        onAssignStaff: modals.handleAssignStaff,
        onAddClass: modals.handleAddClass,
      }}
    >
      <div className="p-6 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reconciliation Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Identify and resolve data inconsistencies across scheduling, communication, and financial domains
          </p>
        </div>

        {tabCounts.isError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Could not load tab counts. Navigation totals may be incomplete.</span>
          </div>
        )}

        <nav
          className="grid w-full max-w-5xl grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 rounded-lg bg-muted p-1 text-muted-foreground"
          aria-label="Reconciliation sections"
        >
          {NAV.map(({ segment, href, label }) => {
            const active = pathname === href || pathname?.startsWith(`${href}/`);
            const badge = formatBadge(segment);
            return (
              <Link
                key={segment}
                href={href}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-all',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'hover:bg-background/60 hover:text-foreground'
                )}
              >
                <span>{label}</span>
                {badge !== null ? (
                  <span
                    className={cn(
                      'tabular-nums rounded-md bg-muted-foreground/15 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground',
                      active && 'bg-primary/10 text-primary'
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {children}

        {tabCounts.isSuccess &&
          totalItems === 0 &&
          pathname !== '/reconciliation/family' &&
          !pathname?.startsWith('/reconciliation/family/') && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">No reconciliation items found</p>
            <p className="text-sm mt-2">All data is consistent!</p>
          </div>
        )}

        <ViewStudentModal
          isOpen={modals.isStudentModalOpen}
          onClose={handleCloseStudent}
          studentId={modals.selectedStudentId}
          onStudentUpdated={() => {
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
          }}
        />

        <ViewParentModal
          isOpen={modals.isParentModalOpen}
          onClose={handleCloseParent}
          parentId={modals.selectedParentId}
          onParentUpdated={() => {
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
          }}
        />

        {currentStaff && (
          <LogSessionModal
            isOpen={modals.isLogSessionModalOpen}
            onClose={handleCloseLogSession}
            currentStaffId={currentStaff.id}
            adminMode={true}
            initialSessionId={modals.logSessionInitialSessionId}
            initialStaffId={modals.logSessionInitialStaffId}
          />
        )}

        <ViewInvoiceModal
          isOpen={modals.isInvoiceModalOpen}
          invoiceId={modals.selectedInvoiceId}
          onClose={modals.handleCloseInvoice}
        />

        <SessionModal
          isOpen={modals.isSessionModalOpen}
          sessionId={modals.selectedSessionId}
          onClose={modals.handleCloseSession}
        />

        <ViewStaffModal
          isOpen={modals.isStaffModalOpen}
          staffId={modals.selectedStaffId}
          onClose={handleCloseStaff}
          onStaffUpdated={() => {
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
          }}
        />

        <ViewClassModal
          isOpen={modals.isClassModalOpen}
          classId={modals.selectedClassId}
          onClose={handleCloseClass}
          onClassUpdated={() => {
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
          }}
        />

        <EditProjectDialog
          isOpen={modals.isProjectModalOpen}
          onClose={handleCloseProject}
          projectId={modals.selectedProjectId}
        />

        {currentStaff && modals.assignStaffClassId && (
          <AssignStaffModalWrapper
            isOpen={modals.isAssignStaffModalOpen}
            classId={modals.assignStaffClassId}
            currentStaffId={currentStaff.id}
            onClose={modals.handleCloseAssignStaff}
            onAssign={handleAssignStaff}
          />
        )}

        {currentStaff && modals.enrollModalStudentId && (
          <EnrollStudentModalWrapper
            isOpen={modals.isEnrollModalOpen}
            studentId={modals.enrollModalStudentId}
            subjectId={modals.enrollModalSubjectId}
            currentStaffId={currentStaff.id}
            onClose={modals.handleCloseEnroll}
            onEnroll={handleEnrollStudent}
          />
        )}
      </div>
    </ReconciliationHandlersProvider>
  );
}
