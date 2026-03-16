'use client';

import { AlertCircle } from 'lucide-react';
import { SkeletonTable } from '@altitutor/ui';
import {
  UninvoicedSessionsTable,
  UnpaidInvoicesTable,
  UnloggedSessionsTable,
  UnassignedClassesTable,
  UnassignedTasksTable,
  FailedDeliveryMessagesTable,
  UnreadMessagesTable,
  MessagesToFollowUpTable,
  StudentsWithoutClassesTable,
  StudentsWithoutPaymentMethodTable,
  TrialStudentsNotSignedUpTable,
} from './ReconciliationTable';
import { ViewStudentModal } from '@/features/students';
import { LogSessionModal } from '@/features/tutor-logs';
import { ViewInvoiceModal } from '@/features/billing';
import { SessionModal } from '@/features/sessions';
import { ViewClassModal } from '@/features/classes';
import { useCurrentStaff } from '@/shared/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { reconciliationKeys } from '../api/queryKeys';
import { ReconciliationHandlersProvider } from './ReconciliationActions';
import {
  useReconciliationData,
  useReconciliationModals,
  useReconciliationItems,
  useAssignStaffMutation,
  useEnrollStudentMutation,
} from '../hooks';
import { AssignStaffModalWrapper } from './AssignStaffModalWrapper';
import { EnrollStudentModalWrapper } from './EnrollStudentModalWrapper';

export function ReconciliationDashboard() {
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();

  // Aggregate all reconciliation queries
  const reconciliationData = useReconciliationData();

  // Manage all modal states
  const modals = useReconciliationModals();

  // Aggregate items for empty state check
  const { hasAnyItems } = useReconciliationItems(reconciliationData);

  // Mutations with automatic query invalidation
  const assignStaffMutation = useAssignStaffMutation();
  const enrollStudentMutation = useEnrollStudentMutation();

  // Handle log session modal close with query invalidation
  const handleCloseLogSession = () => {
    modals.handleCloseLogSession();
    queryClient.invalidateQueries({ queryKey: reconciliationKeys.unloggedSessions() });
  };

  // Handle student modal close with query invalidation
  const handleCloseStudent = () => {
    modals.handleCloseStudent();
    queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
  };

  // Handle class modal close with query invalidation
  const handleCloseClass = () => {
    modals.handleCloseClass();
    queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
  };

  // Handle assign staff with mutation
  const handleAssignStaff = async (params: {
    staffId: string;
    classId: string;
    assignedAt: Date;
    currentStaffId: string;
  }) => {
    await assignStaffMutation.mutateAsync(params);
  };

  // Handle enroll student with mutation
  const handleEnrollStudent = async (params: {
    studentId: string;
    classId: string;
    enrolledAt: Date;
    staffId: string;
  }) => {
    await enrollStudentMutation.mutateAsync(params);
  };

  if (reconciliationData.isLoading) {
    return (
      <div className="p-6 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reconciliation Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Identify and resolve data inconsistencies across scheduling, communication, and financial domains
          </p>
        </div>

        {/* Financial Reconciliation */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Financial</h2>
          <SkeletonTable rows={3} columns={6} />
          <SkeletonTable rows={3} columns={5} />
          <SkeletonTable rows={3} columns={4} />
        </div>

        {/* Scheduling Reconciliation */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Scheduling</h2>
          <SkeletonTable rows={3} columns={6} />
          <SkeletonTable rows={3} columns={5} />
          <SkeletonTable rows={3} columns={4} />
          <SkeletonTable rows={3} columns={4} />
          <SkeletonTable rows={3} columns={4} />
        </div>

        {/* Communication Reconciliation */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Communication</h2>
          <SkeletonTable rows={3} columns={5} />
        </div>

        <div className="text-sm text-muted-foreground">
          Loading reconciliation data...
        </div>
      </div>
    );
  }

  if (reconciliationData.hasError) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Error loading reconciliation data. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ReconciliationHandlersProvider
      handlers={{
        onOpenStudent: modals.handleOpenStudent,
        onLogSession: modals.handleLogSession,
        onOpenInvoice: modals.handleOpenInvoice,
        onOpenSession: modals.handleOpenSession,
        onOpenClass: modals.handleOpenClass,
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

        {/* Financial Reconciliation */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Financial</h2>
          <UninvoicedSessionsTable
            items={reconciliationData.uninvoicedSessions.data ?? []}
            isLoading={reconciliationData.uninvoicedSessions.isLoading}
          />
          <UnpaidInvoicesTable
            items={reconciliationData.unpaidInvoices.data ?? []}
            isLoading={reconciliationData.unpaidInvoices.isLoading}
          />
          <StudentsWithoutPaymentMethodTable
            items={reconciliationData.studentsWithoutPaymentMethod.data ?? []}
            isLoading={reconciliationData.studentsWithoutPaymentMethod.isLoading}
          />
        </div>

        {/* Scheduling Reconciliation */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Scheduling</h2>
          <UnloggedSessionsTable
            items={reconciliationData.unloggedSessions.data ?? []}
            isLoading={reconciliationData.unloggedSessions.isLoading}
          />
          <UnassignedClassesTable
            items={reconciliationData.unassignedClasses.data ?? []}
            isLoading={reconciliationData.unassignedClasses.isLoading}
          />
          <UnassignedTasksTable
            items={reconciliationData.unassignedTasks.data ?? []}
            isLoading={reconciliationData.unassignedTasks.isLoading}
          />
          <StudentsWithoutClassesTable
            items={reconciliationData.studentsWithoutClasses.data ?? []}
            isLoading={reconciliationData.studentsWithoutClasses.isLoading}
          />
          <TrialStudentsNotSignedUpTable
            items={reconciliationData.trialStudentsNotSignedUp.data ?? []}
            isLoading={reconciliationData.trialStudentsNotSignedUp.isLoading}
          />
        </div>

        {/* Communication Reconciliation */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Communication</h2>
          <FailedDeliveryMessagesTable
            items={reconciliationData.failedDeliveryMessages.data ?? []}
            isLoading={reconciliationData.failedDeliveryMessages.isLoading}
          />
          <UnreadMessagesTable />
          <MessagesToFollowUpTable />
        </div>

        {/* Empty state */}
        {!reconciliationData.isLoading && !hasAnyItems && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">No reconciliation items found</p>
            <p className="text-sm mt-2">All data is consistent!</p>
          </div>
        )}

        {/* Student Modal */}
        <ViewStudentModal
          isOpen={modals.isStudentModalOpen}
          onClose={handleCloseStudent}
          studentId={modals.selectedStudentId}
          onStudentUpdated={() => {
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
          }}
        />

        {/* Log Session Modal */}
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

        {/* Invoice Modal */}
        <ViewInvoiceModal
          isOpen={modals.isInvoiceModalOpen}
          invoiceId={modals.selectedInvoiceId}
          onClose={modals.handleCloseInvoice}
        />

        {/* Session Modal */}
        <SessionModal
          isOpen={modals.isSessionModalOpen}
          sessionId={modals.selectedSessionId}
          onClose={modals.handleCloseSession}
        />

        {/* Class Modal */}
        <ViewClassModal
          isOpen={modals.isClassModalOpen}
          classId={modals.selectedClassId}
          onClose={handleCloseClass}
          onClassUpdated={() => {
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
          }}
        />

        {/* Assign Staff Modal */}
        {currentStaff && modals.assignStaffClassId && (
          <AssignStaffModalWrapper
            isOpen={modals.isAssignStaffModalOpen}
            classId={modals.assignStaffClassId}
            currentStaffId={currentStaff.id}
            onClose={modals.handleCloseAssignStaff}
            onAssign={handleAssignStaff}
          />
        )}

        {/* Enroll Student Modal */}
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
