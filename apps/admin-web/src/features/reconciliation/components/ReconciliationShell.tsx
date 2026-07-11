'use client';

import { usePathname, useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { SegmentedControl } from '@altitutor/ui';
import { useReconciliationTabCounts } from '../api/queries';
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
import {
  invalidateReconciliationProjectSurfaces,
  invalidateReconciliationSurfaces,
  invalidateUnloggedSessionSurfaces,
} from '@/shared/lib/query-invalidation';

const NAV = [
  { segment: 'financial', href: '/reconciliation/financial', label: 'Financial' },
  { segment: 'scheduling', href: '/reconciliation/scheduling', label: 'Scheduling' },
  { segment: 'communication', href: '/reconciliation/communication', label: 'Communication' },
  { segment: 'operations', href: '/reconciliation/operations', label: 'Operations' },
] as const;

function tabCountForSegment(
  segment: (typeof NAV)[number]['segment'],
  counts: { financial: number; scheduling: number; communication: number; operations: number } | undefined
): number | undefined {
  if (!counts) return undefined;
  if (segment === 'financial') return counts.financial;
  if (segment === 'scheduling') return counts.scheduling;
  if (segment === 'communication') return counts.communication;
  return counts.operations;
}

export function ReconciliationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabCounts = useReconciliationTabCounts();

  const counts = tabCounts.data;
  const totalItems =
    counts !== undefined
      ? counts.financial + counts.scheduling + counts.communication + counts.operations
      : undefined;

  const formatBadge = (segment: (typeof NAV)[number]['segment']): string | null => {
    if (tabCounts.isPending) return '…';
    if (tabCounts.isError) return '—';
    const n = tabCountForSegment(segment, counts);
    return n === undefined ? '—' : String(n);
  };

  const activeSegment =
    NAV.find(({ href }) => pathname === href || pathname?.startsWith(`${href}/`))?.segment ??
    NAV[0].segment;

  return (
    <ReconciliationInteractionProvider>
      <div className="min-w-0 overflow-x-hidden p-6 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reconciliation Dashboard</h1>
        </div>

        {tabCounts.isError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Could not load tab counts. Navigation totals may be incomplete.</span>
          </div>
        )}

        <SegmentedControl
          className="w-full max-w-5xl min-w-0"
          fullWidth
          value={activeSegment}
          onValueChange={(segment) => {
            const item = NAV.find((navItem) => navItem.segment === segment);
            if (item) router.push(item.href);
          }}
          options={NAV.map(({ segment, label }) => {
            const badge = formatBadge(segment);
            return {
              value: segment,
              label: badge === null ? label : `${label} (${badge})`,
            };
          })}
        />

        {children}

        {tabCounts.isSuccess && totalItems === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">No reconciliation items found</p>
            <p className="text-sm mt-2">All data is consistent!</p>
          </div>
        )}
      </div>
    </ReconciliationInteractionProvider>
  );
}

export function ReconciliationInteractionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  const modals = useReconciliationModals();
  const assignStaffMutation = useAssignStaffMutation();
  const enrollStudentMutation = useEnrollStudentMutation();

  const handleCloseLogSession = () => {
    modals.handleCloseLogSession();
    void invalidateUnloggedSessionSurfaces(queryClient);
  };

  const handleCloseStudent = () => {
    modals.handleCloseStudent();
    void invalidateReconciliationSurfaces(queryClient);
  };

  const handleCloseClass = () => {
    modals.handleCloseClass();
    void invalidateReconciliationSurfaces(queryClient);
  };

  const handleCloseStaff = () => {
    modals.handleCloseStaff();
    void invalidateReconciliationSurfaces(queryClient);
  };

  const handleCloseProject = () => {
    modals.handleCloseProject();
    void invalidateReconciliationProjectSurfaces(queryClient);
  };

  const handleCloseParent = () => {
    modals.handleCloseParent();
    void invalidateReconciliationSurfaces(queryClient);
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
      {children}

        <ViewStudentModal
          isOpen={modals.isStudentModalOpen}
          onClose={handleCloseStudent}
          studentId={modals.selectedStudentId}
          onStudentUpdated={() => {
            void invalidateReconciliationSurfaces(queryClient);
          }}
        />

        <ViewParentModal
          isOpen={modals.isParentModalOpen}
          onClose={handleCloseParent}
          parentId={modals.selectedParentId}
          onParentUpdated={() => {
            void invalidateReconciliationSurfaces(queryClient);
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
            void invalidateReconciliationSurfaces(queryClient);
          }}
        />

        <ViewClassModal
          isOpen={modals.isClassModalOpen}
          classId={modals.selectedClassId}
          onClose={handleCloseClass}
          onClassUpdated={() => {
            void invalidateReconciliationSurfaces(queryClient);
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
    </ReconciliationHandlersProvider>
  );
}
