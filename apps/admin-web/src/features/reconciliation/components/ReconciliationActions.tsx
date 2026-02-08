'use client';

import { useState, createContext, useContext } from 'react';
import { Button } from '@altitutor/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { useDeleteMessage } from '@/features/messages/api/mutations';
import { FileText, User, Calendar, MessageCircle, CreditCard, Receipt, Plus, Trash2 } from 'lucide-react';
import { getErrorMessage } from '@/shared/utils';
import { reconciliationKeys } from '../api/queryKeys';
import { useToast } from '@altitutor/ui';
import { format } from 'date-fns';
import type {
  UninvoicedSession,
  UnpaidInvoice,
  UnloggedSession,
  UnassignedClass,
  FailedDeliveryMessage,
  StudentWithoutClasses,
  StudentWithoutPaymentMethod,
  TrialStudentNotSignedUp,
  ReconciliationItemType,
} from '../types';

interface ReconciliationHandlers {
  onOpenStudent: (studentId: string) => void;
  onLogSession: (sessionId: string, staffId?: string) => void;
  onOpenInvoice: (invoiceId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onOpenClass: (classId: string) => void;
  onAssignStaff: (classId: string) => void;
  onAddClass: (studentId: string, subjectId: string) => void;
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
    | UnpaidInvoice
    | UnloggedSession
    | UnassignedClass
    | FailedDeliveryMessage
    | StudentWithoutClasses
    | StudentWithoutPaymentMethod
    | TrialStudentNotSignedUp;
}

export function ReconciliationActions({ type, item }: ReconciliationActionsProps) {
  const router = useRouter();
  const openWindow = useChatStore((s) => s.openWindow);
  const handlers = useReconciliationHandlers();
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMessageMutation = useDeleteMessage();

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

  const handleSendInvoiceEmail = async (invoiceId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send-invoice`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send invoice');
      }

      const result = await response.json();
      const recipients = result.sent || [];
      const recipientText = recipients.length > 0 
        ? `Sent to: ${recipients.join(', ')}`
        : 'Invoice email sent successfully';

      toast({
        title: 'Success',
        description: recipientText,
      });
      
      // Invalidate reconciliation queries to refresh the list
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.unpaidInvoices() });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to send invoice',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChargeCard = async (invoiceId: string, stripeInvoiceId: string | null) => {
    if (!stripeInvoiceId) {
      toast({
        title: 'Error',
        description: 'Invoice has no Stripe invoice ID',
        variant: 'destructive',
      });
      return;
    }

    // Fetch invoice details from Stripe to check next_payment_attempt
    try {
      const detailsResponse = await fetch(`/api/invoices/${invoiceId}/stripe-details`);
      if (detailsResponse.ok) {
        const details = await detailsResponse.json();
        
        // If there's a future retry scheduled, show confirmation
        if (details.next_payment_attempt) {
          const nextAttemptDate = new Date(details.next_payment_attempt * 1000);
          const formattedDate = format(nextAttemptDate, 'MMM d, yyyy h:mm a');
          
          if (!confirm(`Are you sure you want to attempt this payment now? This payment will already be automatically attempted at ${formattedDate}.`)) {
            return;
          }
        }
      }
    } catch (error) {
      // If we can't fetch details, proceed anyway
      console.warn('Could not fetch invoice details for confirmation:', error);
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/charge-card`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to charge card');
      }

      toast({
        title: 'Success',
        description: 'Payment attempt initiated successfully',
      });
      
      // Invalidate reconciliation queries to refresh the list
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.unpaidInvoices() });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to charge card',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
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
          {invoice.collection_method === 'send_invoice' ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => handleSendInvoiceEmail(invoice.id)}
              disabled={isLoading}
            >
              <CreditCard className="h-4 w-4 mr-1" />
              Resend Invoice
            </Button>
          ) : invoice.collection_method === 'charge_automatically' ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => handleChargeCard(invoice.id, invoice.stripe_invoice_id)}
              disabled={isLoading}
            >
              <CreditCard className="h-4 w-4 mr-1" />
              Charge Card
            </Button>
          ) : null}
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

    case 'failed_delivery_messages': {
      const message = item as FailedDeliveryMessage;
      
      const handleDeleteMessage = async () => {
        if (!confirm('Are you sure you want to delete this failed message? This action cannot be undone.')) {
          return;
        }
        
        try {
          await deleteMessageMutation.mutateAsync(message.message_id);
          toast({
            title: 'Success',
            description: 'Message deleted successfully',
          });
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error);
          toast({
            title: 'Error',
            description: errorMessage || 'Failed to delete message',
            variant: 'destructive',
          });
        }
      };
      
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenConversation(message.conversation_id)}
            disabled={isLoading}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            Open Conversation
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteMessage}
            disabled={isLoading || deleteMessageMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {deleteMessageMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      );
    }

    case 'students_without_payment_method': {
      const student = item as StudentWithoutPaymentMethod;
      const handleOpenStripeSync = () => {
        router.push(`/settings/stripe-sync?studentId=${student.student_id}`);
      };
      
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlers.onOpenStudent(student.student_id)}
          >
            <User className="h-4 w-4 mr-1" />
            View Student
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleOpenStripeSync}
          >
            <CreditCard className="h-4 w-4 mr-1" />
            Stripe Sync
          </Button>
        </div>
      );
    }

    case 'students_without_classes': {
      const student = item as StudentWithoutClasses;
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlers.onOpenStudent(student.student_id)}
          >
            <User className="h-4 w-4 mr-1" />
            View Student
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => handlers.onAddClass(student.student_id, student.subject_id)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Class
          </Button>
        </div>
      );
    }

    case 'trial_students_not_signed_up': {
      const student = item as TrialStudentNotSignedUp;
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlers.onOpenStudent(student.student_id)}
          >
            <User className="h-4 w-4 mr-1" />
            View Student
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleMessageStudent(student.student_id)}
            disabled={isLoading}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            Message
          </Button>
        </div>
      );
    }

    default:
      return null;
  }
}
