'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/features/messages/state/chatStore';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { FileText, User, Calendar, MessageCircle, CreditCard, Users } from 'lucide-react';
import type {
  UninvoicedSession,
  OrphanedInvoiceItem,
  UnpaidInvoice,
  StudentWithoutClasses,
  UnloggedSession,
  UnassignedClass,
  UnreadMessage,
  ReconciliationItemType,
} from '../types';

interface ReconciliationActionsProps {
  type: ReconciliationItemType;
  item:
    | UninvoicedSession
    | OrphanedInvoiceItem
    | UnpaidInvoice
    | StudentWithoutClasses
    | UnloggedSession
    | UnassignedClass
    | UnreadMessage;
}

export function ReconciliationActions({ type, item }: ReconciliationActionsProps) {
  const router = useRouter();
  const openWindow = useChatStore((s) => s.openWindow);
  const { openTutorLogModal } = useQuickActions();
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenStudent = (studentId: string) => {
    router.push(`/students?view=${studentId}`);
  };

  const handleOpenSession = (sessionId: string) => {
    window.dispatchEvent(
      new CustomEvent('open-session-modal', {
        detail: { id: sessionId },
      })
    );
  };

  const handleOpenClass = (classId: string) => {
    router.push(`/classes?view=${classId}`);
  };

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

  const handleLogSession = (sessionId: string) => {
    // Open tutor log modal with session pre-selected
    // This will need to be implemented based on how LogSessionModal works
    openTutorLogModal();
    // Note: We may need to pass sessionId to the modal context
    // For now, opening the modal and user can select session
  };

  const handleSendInvoice = () => {
    // TODO: Implement invoice sending
    // This will likely open a modal or navigate to invoice creation page
    console.log('Send invoice - to be implemented');
  };

  const handleContactStudent = async (studentId: string) => {
    await handleMessageStudent(studentId);
  };

  const handleResendInvoice = () => {
    // TODO: Implement invoice resending
    console.log('Resend invoice - to be implemented');
  };

  const handleAssignStaff = (classId: string) => {
    router.push(`/classes?view=${classId}&tab=staff`);
  };

  switch (type) {
    case 'uninvoiced_sessions': {
      const session = item as UninvoicedSession;
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenStudent(session.student_id)}
          >
            <User className="h-4 w-4 mr-1" />
            View Student
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendInvoice}
            disabled={isLoading}
          >
            <CreditCard className="h-4 w-4 mr-1" />
            Send Invoice
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
            onClick={() => handleOpenStudent(invoiceItem.student_id)}
          >
            <User className="h-4 w-4 mr-1" />
            View Student
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendInvoice}
            disabled={isLoading}
          >
            <CreditCard className="h-4 w-4 mr-1" />
            Create Invoice
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
            onClick={() => handleOpenStudent(invoice.student_id)}
          >
            <User className="h-4 w-4 mr-1" />
            View Student
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleContactStudent(invoice.student_id)}
            disabled={isLoading}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            Contact
          </Button>
          <Button
            variant="outline"
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

    case 'students_without_classes': {
      const student = item as StudentWithoutClasses;
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenStudent(student.student_id)}
          >
            <User className="h-4 w-4 mr-1" />
            View Student
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/classes?addStudent=${student.student_id}`)}
          >
            <Users className="h-4 w-4 mr-1" />
            Add to Class
          </Button>
        </div>
      );
    }

    case 'unlogged_sessions': {
      const session = item as UnloggedSession;
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenSession(session.session_id)}
          >
            <Calendar className="h-4 w-4 mr-1" />
            View Session
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleLogSession(session.session_id)}
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
            onClick={() => handleOpenClass(classItem.class_id)}
          >
            <Calendar className="h-4 w-4 mr-1" />
            View Class
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAssignStaff(classItem.class_id)}
          >
            <Users className="h-4 w-4 mr-1" />
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
