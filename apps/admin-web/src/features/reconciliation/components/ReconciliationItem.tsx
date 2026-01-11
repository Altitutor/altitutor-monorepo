'use client';

import { Card } from '@altitutor/ui';
import { ReconciliationActions } from './ReconciliationActions';
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
import { format } from 'date-fns';
import { cn } from '@/shared/utils/index';

interface ReconciliationItemProps {
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

export function ReconciliationItem({ type, item }: ReconciliationItemProps) {
  const renderContent = () => {
    switch (type) {
      case 'uninvoiced_sessions': {
        const session = item as UninvoicedSession;
        return (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-medium">
                {session.student_first_name} {session.student_last_name}
              </div>
              <div className="text-sm text-muted-foreground">
                {session.subject_name} • {format(new Date(session.session_start_at), 'MMM d, yyyy')}
              </div>
              {session.expected_amount_cents && (
                <div className="text-sm text-muted-foreground mt-1">
                  Expected: ${(session.expected_amount_cents / 100).toFixed(2)} {session.currency}
                </div>
              )}
            </div>
            <ReconciliationActions
              type={type}
              item={item}
            />
          </div>
        );
      }

      case 'orphaned_invoice_items': {
        const invoiceItem = item as OrphanedInvoiceItem;
        return (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-medium">{invoiceItem.description}</div>
              <div className="text-sm text-muted-foreground">
                {invoiceItem.student_first_name} {invoiceItem.student_last_name} •{' '}
                {invoiceItem.subject_name}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Amount: ${(invoiceItem.amount_cents / 100).toFixed(2)}
              </div>
            </div>
            <ReconciliationActions
              type={type}
              item={item}
            />
          </div>
        );
      }

      case 'unpaid_invoices': {
        const invoice = item as UnpaidInvoice;
        const isOverdue = invoice.days_overdue && invoice.days_overdue > 0;
        return (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-medium">
                Invoice #{invoice.id.slice(0, 8)} • {invoice.student_first_name}{' '}
                {invoice.student_last_name}
              </div>
              <div className="text-sm text-muted-foreground">
                Due: {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : 'No due date'}
                {isOverdue && (
                  <span className={cn('ml-2 font-medium', isOverdue && 'text-destructive')}>
                    ({invoice.days_overdue} days overdue)
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Amount Due: ${(invoice.amount_due_cents / 100).toFixed(2)} {invoice.currency}
              </div>
            </div>
            <ReconciliationActions
              type={type}
              item={item}
            />
          </div>
        );
      }

      case 'students_without_classes': {
        const student = item as StudentWithoutClasses;
        return (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-medium">
                {student.first_name} {student.last_name}
              </div>
              <div className="text-sm text-muted-foreground">
                {student.subjects && student.subjects.length > 0
                  ? `Subjects: ${student.subjects.map((s) => s.name).join(', ')}`
                  : 'No subjects'}
              </div>
            </div>
            <ReconciliationActions
              type={type}
              item={item}
            />
          </div>
        );
      }

      case 'unlogged_sessions': {
        const session = item as UnloggedSession;
        return (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-medium">
                {session.subject_name} • {format(new Date(session.start_at), 'MMM d, yyyy')}
              </div>
              <div className="text-sm text-muted-foreground">
                {session.assigned_tutors && session.assigned_tutors.length > 0
                  ? `Tutors: ${session.assigned_tutors.map((t) => `${t.first_name} ${t.last_name}`).join(', ')}`
                  : 'No tutors assigned'}
                {session.student_count > 0 && ` • ${session.student_count} student(s)`}
              </div>
            </div>
            <ReconciliationActions
              type={type}
              item={item}
            />
          </div>
        );
      }

      case 'unassigned_classes': {
        const classItem = item as UnassignedClass;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-medium">
                {classItem.subject_name} • {dayNames[classItem.day_of_week]} {classItem.start_time} - {classItem.end_time}
              </div>
              <div className="text-sm text-muted-foreground">
                {classItem.student_count} student(s) enrolled
              </div>
            </div>
            <ReconciliationActions
              type={type}
              item={item}
            />
          </div>
        );
      }

      case 'unread_messages': {
        const message = item as UnreadMessage;
        const hoursAgo = message.hours_since_last_message
          ? Math.floor(message.hours_since_last_message)
          : null;
        return (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-medium">
                {message.contact_name || message.contact_phone}
              </div>
              <div className="text-sm text-muted-foreground line-clamp-2">
                {message.last_message_preview}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {message.unread_count} unread message(s)
                {hoursAgo !== null && ` • ${hoursAgo}h ago`}
              </div>
            </div>
            <ReconciliationActions
              type={type}
              item={item}
            />
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-4">{renderContent()}</div>
    </Card>
  );
}
