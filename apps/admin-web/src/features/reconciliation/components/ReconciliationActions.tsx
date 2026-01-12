'use client';

import { useState, createContext, useContext } from 'react';
import { Button } from '@altitutor/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { FileText, User, Calendar, MessageCircle, CreditCard, Receipt } from 'lucide-react';
import { reconciliationKeys } from '../api/queryKeys';
import { useToast } from '@altitutor/ui';
import type {
  UninvoicedSession,
  OrphanedInvoiceItem,
  UnpaidInvoice,
  UnloggedSession,
  UnassignedClass,
  UnreadMessage,
  ReconciliationItemType,
} from '../types';

interface ReconciliationHandlers {
  onOpenStudent: (studentId: string) => void;
  onLogSession: (sessionId: string, staffId?: string) => void;
  onOpenInvoice: (invoiceId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onOpenClass: (classId: string) => void;
  onAssignStaff: (classId: string) => void;
}

const ReconciliationHandlersContext = createContext<ReconciliationHandlers | null>(null);

export function ReconciliationHandlersProvider({
  children,
  handlers,
}: {
  children: React.ReactNode;
  handlers: ReconciliationHandlers;
}) {
  return (
    <ReconciliationHandlersContext.Provider value={handlers}>
      {children}
    </ReconciliationHandlersContext.Provider>
  );
}

function useReconciliationHandlers() {
  const context = useContext(ReconciliationHandlersContext);
  if (!context) {
    throw new Error('useReconciliationHandlers must be used within ReconciliationHandlersProvider');
  }
  return context;
}

interface ReconciliationActionsProps {
  type: ReconciliationItemType;
  item:
    | UninvoicedSession
    | OrphanedInvoiceItem
    | UnpaidInvoice
    | UnloggedSession
    | UnassignedClass
    | UnreadMessage;
}

export function ReconciliationActions({ type, item }: ReconciliationActionsProps) {
  const openWindow = useChatStore((s) => s.openWindow);
  const handlers = useReconciliationHandlers();
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleOpenConversation = async (conversationId: string) => {
    try {
      openWindow({ conversationId, title: 'Conversation' });
    } catch (error) {
      console.error('Failed to open conversation:', error);
    }
  };

  const handleMessageStudent = async (studentId: string) => {
    setIsLoading(true);
    try {
      const conversationId = await ensureConversationForRelated(studentId, 'student');
      if (conversationId) {
        openWindow({ conversationId, title: 'Student' });
      }
    } catch (error) {
      console.error('Failed to open conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Mutation for invoicing a single session
  const invoiceSessionMutation = useMutation({
    mutationFn: async (sessions_students_id: string) => {
      const response = await fetch('/api/billing/single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessions_students_id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to invoice session');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate reconciliation queries to refresh the list
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.uninvoicedSessions() });
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.orphanedInvoiceItems() });
      toast({
        title: 'Success',
        description: 'Session invoiced successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to invoice session',
        variant: 'destructive',
      });
    },
  });

  const handleSendInvoice = (sessions_students_id: string) => {
    invoiceSessionMutation.mutate(sessions_students_id);
  };

  const handleContactStudent = async (studentId: string) => {
    await handleMessageStudent(studentId);
  };

  const handleResendInvoice = () => {
    // TODO: Implement invoice resending
    console.log('Resend invoice - to be implemented');
  };

  switch (type) {
    case 'uninvoiced_sessions': {
      const session = item as UninvoicedSession;
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlers.onOpenSession(session.session_id)}
          >
            <Calendar className="h-4 w-4 mr-1" />
            View Session
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleSendInvoice(session.sessions_students_id)}
            disabled={isLoading || invoiceSessionMutation.isPending}
          >
            <CreditCard className="h-4 w-4 mr-1" />
            {invoiceSessionMutation.isPending ? 'Invoicing...' : 'Invoice Session'}
          </Button>
        </div>
      );
    }

    case 'orphaned_invoice_items': {
      const invoiceItem = item as OrphanedInvoiceItem;
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlers.onOpenStudent(invoiceItem.student_id)}
          >
            <User className="h-4 w-4 mr-1" />
            View Student
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleSendInvoice(invoiceItem.sessions_students_id)}
            disabled={isLoading || invoiceSessionMutation.isPending}
          >
            <CreditCard className="h-4 w-4 mr-1" />
            {invoiceSessionMutation.isPending ? 'Invoicing...' : 'Create Invoice'}
          </Button>
        </div>
      );
    }

    case 'unpaid_invoices': {
      const invoice = item as UnpaidInvoice;
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlers.onOpenInvoice(invoice.id)}
          >
            <Receipt className="h-4 w-4 mr-1" />
            View Invoice
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleContactStudent(invoice.student_id)}
            disabled={isLoading}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            Contact
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleResendInvoice}
            disabled={isLoading}
          >
            <CreditCard className="h-4 w-4 mr-1" />
            Resend Invoice
          </Button>
        </div>
      );
    }

    case 'unlogged_sessions': {
      const session = item as UnloggedSession;
      // Get first tutor ID for logging
      const firstStaffId = session.assigned_tutors && session.assigned_tutors.length > 0
        ? session.assigned_tutors[0].id
        : undefined;
      
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlers.onOpenSession(session.session_id)}
          >
            <Calendar className="h-4 w-4 mr-1" />
            View Session
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => handlers.onLogSession(session.session_id, firstStaffId)}
            disabled={isLoading}
          >
            <FileText className="h-4 w-4 mr-1" />
            Log Session
          </Button>
        </div>
      );
    }

    case 'unassigned_classes': {
      const classItem = item as UnassignedClass;
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlers.onOpenClass(classItem.class_id)}
          >
            <Calendar className="h-4 w-4 mr-1" />
            View Class
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => handlers.onAssignStaff(classItem.class_id)}
          >
            <User className="h-4 w-4 mr-1" />
            Assign Staff
          </Button>
        </div>
      );
    }

    case 'unread_messages': {
      const message = item as UnreadMessage;
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenConversation(message.conversation_id)}
            disabled={isLoading}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            Open Message
          </Button>
        </div>
      );
    }

    default:
      return null;
  }
}
