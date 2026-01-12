'use client';

import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import {
  UninvoicedSessionsTable,
  OrphanedInvoiceItemsTable,
  UnpaidInvoicesTable,
  UnloggedSessionsTable,
  UnassignedClassesTable,
  UnreadMessagesTable,
} from './ReconciliationTable';
import {
  useUninvoicedSessions,
  useOrphanedInvoiceItems,
  useUnpaidInvoices,
  useUnloggedSessions,
  useUnassignedClasses,
  useUnreadMessages,
} from '../api/queries';
import { ViewStudentModal } from '@/features/students';
import { LogSessionModal } from '@/features/tutor-logs';
import { ViewInvoiceModal } from '@/features/billing';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useQueryClient } from '@tanstack/react-query';
import { reconciliationKeys } from '../api/queryKeys';
import { ReconciliationHandlersProvider } from './ReconciliationActions';

export function ReconciliationDashboard() {
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  
  // Modal states
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [logSessionInitialSessionId, setLogSessionInitialSessionId] = useState<string | undefined>();
  const [logSessionInitialStaffId, setLogSessionInitialStaffId] = useState<string | undefined>();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Fetch all reconciliation data
  const uninvoicedSessions = useUninvoicedSessions();
  const orphanedInvoiceItems = useOrphanedInvoiceItems();
  const unpaidInvoices = useUnpaidInvoices();
  const unloggedSessions = useUnloggedSessions();
  const unassignedClasses = useUnassignedClasses();
  const unreadMessages = useUnreadMessages();

  // Check if any query is loading
  const isLoading =
    uninvoicedSessions.isLoading ||
    orphanedInvoiceItems.isLoading ||
    unpaidInvoices.isLoading ||
    unloggedSessions.isLoading ||
    unassignedClasses.isLoading ||
    unreadMessages.isLoading;

  // Check if any query has error
  const hasError =
    uninvoicedSessions.isError ||
    orphanedInvoiceItems.isError ||
    unpaidInvoices.isError ||
    unloggedSessions.isError ||
    unassignedClasses.isError ||
    unreadMessages.isError;

  // Handlers for opening modals
  const handleOpenStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsStudentModalOpen(true);
  };

  const handleLogSession = (sessionId: string, staffId?: string) => {
    setLogSessionInitialSessionId(sessionId);
    setLogSessionInitialStaffId(staffId);
    setIsLogSessionModalOpen(true);
  };

  const handleOpenInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setIsInvoiceModalOpen(true);
  };

  const handleCloseLogSessionModal = async () => {
    setIsLogSessionModalOpen(false);
    setLogSessionInitialSessionId(undefined);
    setLogSessionInitialStaffId(undefined);
    // Refresh unlogged sessions after logging
    queryClient.invalidateQueries({ queryKey: reconciliationKeys.unloggedSessions() });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (hasError) {
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

  const financialItems = [
    ...(uninvoicedSessions.data ?? []),
    ...(orphanedInvoiceItems.data ?? []),
    ...(unpaidInvoices.data ?? []),
  ];
  const schedulingItems = [
    ...(unloggedSessions.data ?? []),
    ...(unassignedClasses.data ?? []),
  ];
  const communicationItems = unreadMessages.data ?? [];

  return (
    <ReconciliationHandlersProvider
      handlers={{
        onOpenStudent: handleOpenStudent,
        onLogSession: handleLogSession,
        onOpenInvoice: handleOpenInvoice,
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
        {(financialItems.length > 0 || isLoading) && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Financial</h2>
            <UninvoicedSessionsTable
              items={uninvoicedSessions.data ?? []}
              isLoading={uninvoicedSessions.isLoading}
            />
            <OrphanedInvoiceItemsTable
              items={orphanedInvoiceItems.data ?? []}
              isLoading={orphanedInvoiceItems.isLoading}
            />
            <UnpaidInvoicesTable
              items={unpaidInvoices.data ?? []}
              isLoading={unpaidInvoices.isLoading}
            />
          </div>
        )}

        {/* Scheduling Reconciliation */}
        {(schedulingItems.length > 0 || isLoading) && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Scheduling</h2>
            <UnloggedSessionsTable
              items={unloggedSessions.data ?? []}
              isLoading={unloggedSessions.isLoading}
            />
            <UnassignedClassesTable
              items={unassignedClasses.data ?? []}
              isLoading={unassignedClasses.isLoading}
            />
          </div>
        )}

        {/* Communication Reconciliation */}
        {(communicationItems.length > 0 || isLoading) && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Communication</h2>
            <UnreadMessagesTable
              items={unreadMessages.data ?? []}
              isLoading={unreadMessages.isLoading}
            />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && financialItems.length === 0 && schedulingItems.length === 0 && communicationItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">No reconciliation items found</p>
            <p className="text-sm mt-2">All data is consistent!</p>
          </div>
        )}

        {/* Student Modal */}
        <ViewStudentModal
          isOpen={isStudentModalOpen}
          onClose={() => {
            setIsStudentModalOpen(false);
            setSelectedStudentId(null);
          }}
          studentId={selectedStudentId}
          onStudentUpdated={() => {
            // Refresh reconciliation data
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
          }}
        />

        {/* Log Session Modal */}
        {currentStaff && (
          <LogSessionModal
            isOpen={isLogSessionModalOpen}
            onClose={handleCloseLogSessionModal}
            currentStaffId={currentStaff.id}
            adminMode={true}
            initialSessionId={logSessionInitialSessionId}
            initialStaffId={logSessionInitialStaffId}
          />
        )}

        {/* Invoice Modal */}
        <ViewInvoiceModal
          isOpen={isInvoiceModalOpen}
          invoiceId={selectedInvoiceId}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setSelectedInvoiceId(null);
          }}
        />
      </div>
    </ReconciliationHandlersProvider>
  );
}
