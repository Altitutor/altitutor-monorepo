'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@altitutor/ui';
import { Loader2, AlertCircle } from 'lucide-react';
import { ReconciliationCategory } from './ReconciliationCategory';
import {
  useUninvoicedSessions,
  useOrphanedInvoiceItems,
  useUnpaidInvoices,
  useStudentsWithoutClasses,
  useUnloggedSessions,
  useUnassignedClasses,
  useUnreadMessages,
} from '../api/queries';
import type { ReconciliationCategoryData } from '../types';

export function ReconciliationDashboard() {
  // Fetch all reconciliation data
  const uninvoicedSessions = useUninvoicedSessions();
  const orphanedInvoiceItems = useOrphanedInvoiceItems();
  const unpaidInvoices = useUnpaidInvoices();
  const studentsWithoutClasses = useStudentsWithoutClasses();
  const unloggedSessions = useUnloggedSessions();
  const unassignedClasses = useUnassignedClasses();
  const unreadMessages = useUnreadMessages();

  // Check if any query is loading
  const isLoading =
    uninvoicedSessions.isLoading ||
    orphanedInvoiceItems.isLoading ||
    unpaidInvoices.isLoading ||
    studentsWithoutClasses.isLoading ||
    unloggedSessions.isLoading ||
    unassignedClasses.isLoading ||
    unreadMessages.isLoading;

  // Check if any query has error
  const hasError =
    uninvoicedSessions.isError ||
    orphanedInvoiceItems.isError ||
    unpaidInvoices.isError ||
    studentsWithoutClasses.isError ||
    unloggedSessions.isError ||
    unassignedClasses.isError ||
    unreadMessages.isError;

  // Calculate counts
  const financialData: ReconciliationCategoryData = {
    category: 'financial',
    items: {
      uninvoiced_sessions: uninvoicedSessions.data ?? [],
      orphaned_invoice_items: orphanedInvoiceItems.data ?? [],
      unpaid_invoices: unpaidInvoices.data ?? [],
    },
    counts: {
      uninvoiced_sessions: uninvoicedSessions.data?.length ?? 0,
      orphaned_invoice_items: orphanedInvoiceItems.data?.length ?? 0,
      unpaid_invoices: unpaidInvoices.data?.length ?? 0,
      students_without_classes: 0,
      unlogged_sessions: 0,
      unassigned_classes: 0,
      unread_messages: 0,
    },
  };

  const schedulingData: ReconciliationCategoryData = {
    category: 'scheduling',
    items: {
      students_without_classes: studentsWithoutClasses.data ?? [],
      unlogged_sessions: unloggedSessions.data ?? [],
      unassigned_classes: unassignedClasses.data ?? [],
    },
    counts: {
      uninvoiced_sessions: 0,
      orphaned_invoice_items: 0,
      unpaid_invoices: 0,
      students_without_classes: studentsWithoutClasses.data?.length ?? 0,
      unlogged_sessions: unloggedSessions.data?.length ?? 0,
      unassigned_classes: unassignedClasses.data?.length ?? 0,
      unread_messages: 0,
    },
  };

  const communicationData: ReconciliationCategoryData = {
    category: 'communication',
    items: {
      unread_messages: unreadMessages.data ?? [],
    },
    counts: {
      uninvoiced_sessions: 0,
      orphaned_invoice_items: 0,
      unpaid_invoices: 0,
      students_without_classes: 0,
      unlogged_sessions: 0,
      unassigned_classes: 0,
      unread_messages: unreadMessages.data?.length ?? 0,
    },
  };

  // Calculate total counts per category
  const financialTotal =
    financialData.counts.uninvoiced_sessions +
    financialData.counts.orphaned_invoice_items +
    financialData.counts.unpaid_invoices;

  const schedulingTotal =
    schedulingData.counts.students_without_classes +
    schedulingData.counts.unlogged_sessions +
    schedulingData.counts.unassigned_classes;

  const communicationTotal = communicationData.counts.unread_messages;

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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Error loading reconciliation data. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reconciliation Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Identify and resolve data inconsistencies across scheduling, communication, and financial domains
        </p>
      </div>

      {/* Financial Reconciliation */}
      <ReconciliationCategory
        title="Financial"
        totalCount={financialTotal}
        data={financialData}
      />

      {/* Scheduling Reconciliation */}
      <ReconciliationCategory
        title="Scheduling"
        totalCount={schedulingTotal}
        data={schedulingData}
      />

      {/* Communication Reconciliation */}
      <ReconciliationCategory
        title="Communication"
        totalCount={communicationTotal}
        data={communicationData}
      />
    </div>
  );
}
