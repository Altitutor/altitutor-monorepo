'use client';

import { AlertCircle } from 'lucide-react';
import { SkeletonTable } from '@altitutor/ui';
import {
  UninvoicedSessionsTable,
  VoidInvoiceSessionsTable,
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
  ProjectsWithoutLeadTable,
} from './ReconciliationTable';
import {
  useReconciliationFinancialData,
  useReconciliationSchedulingData,
  useReconciliationCommunicationData,
  useReconciliationOperationsData,
} from '../hooks';

function FinancialTabSkeleton() {
  return (
    <div className="space-y-6 mt-6" aria-busy="true">
      <SkeletonTable rows={3} columns={6} />
      <SkeletonTable rows={3} columns={7} />
      <SkeletonTable rows={3} columns={5} />
      <SkeletonTable rows={3} columns={4} />
    </div>
  );
}

function SchedulingTabSkeleton() {
  return (
    <div className="space-y-6 mt-6" aria-busy="true">
      <SkeletonTable rows={3} columns={6} />
      <SkeletonTable rows={3} columns={5} />
      <SkeletonTable rows={3} columns={4} />
      <SkeletonTable rows={3} columns={4} />
    </div>
  );
}

function CommunicationTabSkeleton() {
  return (
    <div className="space-y-6 mt-6" aria-busy="true">
      <SkeletonTable rows={3} columns={5} />
      <SkeletonTable rows={3} columns={2} />
      <SkeletonTable rows={3} columns={2} />
    </div>
  );
}

function OperationsTabSkeleton() {
  return (
    <div className="space-y-6 mt-6" aria-busy="true">
      <SkeletonTable rows={3} columns={4} />
      <SkeletonTable rows={3} columns={5} />
    </div>
  );
}

export function ReconciliationFinancialTab() {
  const data = useReconciliationFinancialData();

  if (data.isLoading) {
    return <FinancialTabSkeleton />;
  }

  if (data.hasError) {
    return (
      <div className="mt-6 rounded-md border border-destructive bg-destructive/10 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>Error loading financial reconciliation data. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      <UninvoicedSessionsTable
        items={data.uninvoicedSessions.data ?? []}
        isLoading={data.uninvoicedSessions.isLoading}
      />
      <VoidInvoiceSessionsTable
        items={data.voidInvoiceSessions.data ?? []}
        isLoading={data.voidInvoiceSessions.isLoading}
      />
      <UnpaidInvoicesTable
        items={data.unpaidInvoices.data ?? []}
        isLoading={data.unpaidInvoices.isLoading}
      />
      <StudentsWithoutPaymentMethodTable
        items={data.studentsWithoutPaymentMethod.data ?? []}
        isLoading={data.studentsWithoutPaymentMethod.isLoading}
      />
    </div>
  );
}

export function ReconciliationSchedulingTab() {
  const data = useReconciliationSchedulingData();

  if (data.isLoading) {
    return <SchedulingTabSkeleton />;
  }

  if (data.hasError) {
    return (
      <div className="mt-6 rounded-md border border-destructive bg-destructive/10 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>Error loading scheduling reconciliation data. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      <UnloggedSessionsTable
        items={data.unloggedSessions.data ?? []}
        isLoading={data.unloggedSessions.isLoading}
      />
      <UnassignedClassesTable
        items={data.unassignedClasses.data ?? []}
        isLoading={data.unassignedClasses.isLoading}
      />
      <StudentsWithoutClassesTable
        items={data.studentsWithoutClasses.data ?? []}
        isLoading={data.studentsWithoutClasses.isLoading}
      />
      <TrialStudentsNotSignedUpTable
        items={data.trialStudentsNotSignedUp.data ?? []}
        isLoading={data.trialStudentsNotSignedUp.isLoading}
      />
    </div>
  );
}

export function ReconciliationCommunicationTab() {
  const data = useReconciliationCommunicationData();

  if (data.isLoading) {
    return <CommunicationTabSkeleton />;
  }

  if (data.hasError) {
    return (
      <div className="mt-6 rounded-md border border-destructive bg-destructive/10 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>Error loading communication reconciliation data. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      <FailedDeliveryMessagesTable
        items={data.failedDeliveryMessages.data ?? []}
        isLoading={data.failedDeliveryMessages.isLoading}
      />
      <UnreadMessagesTable />
      <MessagesToFollowUpTable />
    </div>
  );
}

export function ReconciliationOperationsTab() {
  const data = useReconciliationOperationsData();

  if (data.isLoading) {
    return <OperationsTabSkeleton />;
  }

  if (data.hasError) {
    return (
      <div className="mt-6 rounded-md border border-destructive bg-destructive/10 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>Error loading operations reconciliation data. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      <UnassignedTasksTable
        items={data.unassignedTasks.data ?? []}
        isLoading={data.unassignedTasks.isLoading}
      />
      <ProjectsWithoutLeadTable
        items={data.projectsWithNoLead.data ?? []}
        isLoading={data.projectsWithNoLead.isLoading}
      />
    </div>
  );
}
