'use client';

import { useMemo, useState, createContext, useContext } from 'react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@altitutor/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/features/messages/state/chatStore';
import type { AggregatedConversation } from '@/features/messages/types';
import { ensureConversationForRelated } from '@/features/messages/api/queries';
import { formatContactName } from '@/features/messages/utils/formatContactName';
import { useDeleteMessage } from '@/features/messages/api/mutations';
import { FileText, MessageCircle, CreditCard, Plus, Trash2, User } from 'lucide-react';
import { getErrorMessage } from '@/shared/utils';
import { reconciliationKeys } from '../api/queryKeys';
import { useToast } from '@altitutor/ui';
import { format } from 'date-fns';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { CreateIssueDialog } from '@/features/issues/components/CreateIssueDialog';
import { EditIssueDialog } from '@/features/issues/components/EditIssueDialog';
import { useIssues } from '@/features/issues/api/queries';
import { issuesApi } from '@/features/issues/api/issues';
import type { IssueTagInsert, IssueWithTags, IssueUpdate } from '@/features/issues/types';
import type { JSONContent } from '@altitutor/ui';
import { extractMentions } from '@/shared/utils/extractMentions';
import { getTagEntity, resolveTagLabels } from '@/features/issues/utils/mentionLabels';
import type {
  UninvoicedSession,
  VoidInvoiceSession,
  UnpaidInvoice,
  UnloggedSession,
  UnassignedClass,
  UnassignedTask,
  FailedDeliveryMessage,
  StudentWithoutClasses,
  StudentWithoutPaymentMethod,
  TrialStudentNotSignedUp,
  ReconciliationItemType,
  ProjectWithoutLead,
} from '../types';

type IssueTagDraft = Omit<IssueTagInsert, 'issue_id'>;

function getTagKey(tag: Partial<IssueTagInsert>) {
  if (tag.student_id) return `student:${tag.student_id}`;
  if (tag.staff_id) return `staff:${tag.staff_id}`;
  if (tag.parent_id) return `parent:${tag.parent_id}`;
  if (tag.class_id) return `class:${tag.class_id}`;
  if (tag.session_id) return `session:${tag.session_id}`;
  if (tag.invoice_id) return `invoice:${tag.invoice_id}`;
  if (tag.subject_id) return `subject:${tag.subject_id}`;
  return null;
}

function dedupeTags(tags: IssueTagDraft[]): IssueTagDraft[] {
  const seen = new Set<string>();
  const result: IssueTagDraft[] = [];

  tags.forEach((tag) => {
    const key = getTagKey(tag);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(tag);
  });

  return result;
}

function issueTagToDraft(tag: IssueWithTags['tags'][number]): IssueTagDraft | null {
  if (tag.student_id) return { student_id: tag.student_id };
  if (tag.staff_id) return { staff_id: tag.staff_id };
  if (tag.parent_id) return { parent_id: tag.parent_id };
  if (tag.class_id) return { class_id: tag.class_id };
  if (tag.session_id) return { session_id: tag.session_id };
  if (tag.invoice_id) return { invoice_id: tag.invoice_id };
  if (tag.subject_id) return { subject_id: tag.subject_id };
  return null;
}

interface ReconciliationHandlers {
  onOpenStudent: (studentId: string) => void;
  onLogSession: (sessionId: string, staffId?: string) => void;
  onOpenInvoice: (invoiceId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onOpenClass: (classId: string) => void;
  onOpenStaff: (staffId: string) => void;
  onOpenParent: (parentId: string) => void;
  onOpenProject: (projectId: string) => void;
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

export function useReconciliationHandlers() {
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
    | VoidInvoiceSession
    | UnpaidInvoice
    | UnloggedSession
    | UnassignedClass
    | UnassignedTask
    | FailedDeliveryMessage
    | StudentWithoutClasses
    | StudentWithoutPaymentMethod
    | TrialStudentNotSignedUp
    | ProjectWithoutLead
    | AggregatedConversation;
}

export function ReconciliationActions({ type, item }: ReconciliationActionsProps) {
  const router = useRouter();
  const openWindow = useChatStore((s) => s.openWindow);
  const handlers = useReconciliationHandlers();
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMessageMutation = useDeleteMessage();

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
    onSuccess: (data: { invoiceId?: string } | null | undefined) => {
      // Invalidate reconciliation queries to refresh the list
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.uninvoicedSessions() });
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.voidInvoiceSessions() });
      toast({
        title: 'Success',
        description: (
          <div className="flex items-center gap-2">
            <span>Session invoiced successfully.</span>
            {data?.invoiceId && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => handlers.onOpenInvoice(data.invoiceId!)}
              >
                View invoice
              </Button>
            )}
          </div>
        ),
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

  const archiveVoidInvoiceMutation = useMutation({
    mutationFn: async (invoice_id: string) => {
      const response = await fetch('/api/billing/soft-delete-void-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id }),
      });
      if (!response.ok) {
        const err = (await response.json()) as { error?: string; message?: string };
        throw new Error(err.error || err.message || 'Failed to delete void invoice');
      }
      return response.json() as Promise<{ ok: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.voidInvoiceSessions() });
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.uninvoicedSessions() });
      toast({
        title: 'Deleted',
        description: 'Void invoice rows were soft-deleted in the database.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete void invoice',
        variant: 'destructive',
      });
    },
  });

  const handleSendInvoice = (sessions_students_id: string) => {
    invoiceSessionMutation.mutate(sessions_students_id);
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

  const { data: candidateIssues = [] } = useIssues({ status: ['open', 'awaiting_response'] });
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [isEditIssueOpen, setIsEditIssueOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [createIssueTags, setCreateIssueTags] = useState<IssueTagDraft[]>([]);
  const [isIssueActionLoading, setIsIssueActionLoading] = useState(false);

  const matchedIssues = useMemo(() => {
    const hasTag = (issue: IssueWithTags, predicate: (tag: IssueWithTags['tags'][number]) => boolean) =>
      issue.tags.some(predicate);

    return candidateIssues.filter((issue) => {
      if (type === 'uninvoiced_sessions') {
        const current = item as UninvoicedSession;
        return (
          hasTag(issue, (tag) => tag.student_id === current.student_id) &&
          hasTag(issue, (tag) => tag.session_id === current.session_id)
        );
      }

      if (type === 'void_invoice_sessions') {
        const current = item as VoidInvoiceSession;
        return (
          hasTag(issue, (tag) => tag.student_id === current.student_id) &&
          hasTag(issue, (tag) => tag.session_id === current.session_id)
        );
      }

      if (type === 'unpaid_invoices') {
        const current = item as UnpaidInvoice;
        return (
          hasTag(issue, (tag) => tag.student_id === current.student_id) &&
          hasTag(issue, (tag) => tag.invoice_id === current.id)
        );
      }

      if (type === 'students_without_payment_method') {
        const current = item as StudentWithoutPaymentMethod;
        return hasTag(issue, (tag) => tag.student_id === current.student_id);
      }

      if (type === 'unlogged_sessions') {
        const current = item as UnloggedSession;
        const staffIds = (current.assigned_tutors ?? []).map((staff) => staff.id);
        return (
          hasTag(issue, (tag) => tag.session_id === current.session_id) &&
          staffIds.length > 0 &&
          hasTag(issue, (tag) => !!tag.staff_id && staffIds.includes(tag.staff_id))
        );
      }

      if (type === 'unassigned_classes') {
        const current = item as UnassignedClass;
        return hasTag(issue, (tag) => tag.class_id === current.class_id);
      }

      if (type === 'students_without_classes') {
        const current = item as StudentWithoutClasses;
        return (
          hasTag(issue, (tag) => tag.student_id === current.student_id) &&
          hasTag(issue, (tag) => tag.subject_id === current.subject_id)
        );
      }

      if (type === 'trial_students_not_signed_up') {
        const current = item as TrialStudentNotSignedUp;
        return (
          !!current.first_trial_session_id &&
          hasTag(issue, (tag) => tag.student_id === current.student_id) &&
          hasTag(issue, (tag) => tag.session_id === current.first_trial_session_id)
        );
      }

      if (type === 'projects_without_lead') {
        return false;
      }

      if (type === 'reconciliation_contact_messages') {
        return false;
      }

      return false;
    });
  }, [candidateIssues, item, type]);

  const getParentIdsForStudent = async (studentId: string): Promise<string[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('parents_students')
      .select('parent_id')
      .eq('student_id', studentId);

    if (error) throw error;
    return Array.from(new Set((data ?? []).map((row) => row.parent_id)));
  };

  const getFirstTrialSessionIdForStudent = async (studentId: string): Promise<string | null> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('sessions_students')
      .select('session_id, sessions!inner(type, start_at)')
      .eq('student_id', studentId);

    if (error) throw error;

    const trialRows = (data ?? [])
      .filter((row) => (row.sessions as { type: string } | null)?.type === 'TRIAL_SESSION')
      .sort((a, b) => {
        const aTime = new Date((a.sessions as { start_at: string } | null)?.start_at ?? 0).getTime();
        const bTime = new Date((b.sessions as { start_at: string } | null)?.start_at ?? 0).getTime();
        return aTime - bTime;
      });

    return trialRows[0]?.session_id ?? null;
  };

  const getIssueTagsForItem = async (): Promise<IssueTagDraft[]> => {
    if (type === 'uninvoiced_sessions') {
      const current = item as UninvoicedSession;
      return dedupeTags([
        { student_id: current.student_id },
        { session_id: current.session_id },
      ]);
    }

    if (type === 'void_invoice_sessions') {
      const current = item as VoidInvoiceSession;
      return dedupeTags([
        { student_id: current.student_id },
        { session_id: current.session_id },
        { invoice_id: current.void_invoice_id },
      ]);
    }

    if (type === 'unpaid_invoices') {
      const current = item as UnpaidInvoice;
      const parentIds = await getParentIdsForStudent(current.student_id);
      return dedupeTags([
        { student_id: current.student_id },
        { invoice_id: current.id },
        ...parentIds.map((parentId) => ({ parent_id: parentId })),
      ]);
    }

    if (type === 'students_without_payment_method') {
      const current = item as StudentWithoutPaymentMethod;
      return [{ student_id: current.student_id }];
    }

    if (type === 'unlogged_sessions') {
      const current = item as UnloggedSession;
      return dedupeTags([
        { session_id: current.session_id },
        ...(current.assigned_tutors ?? []).map((staff) => ({ staff_id: staff.id })),
      ]);
    }

    if (type === 'unassigned_classes') {
      const current = item as UnassignedClass;
      return [{ class_id: current.class_id }];
    }

    if (type === 'students_without_classes') {
      const current = item as StudentWithoutClasses;
      return dedupeTags([
        { student_id: current.student_id },
        { subject_id: current.subject_id },
      ]);
    }

    if (type === 'trial_students_not_signed_up') {
      const current = item as TrialStudentNotSignedUp;
      const parentIds = await getParentIdsForStudent(current.student_id);
      const sessionId = current.first_trial_session_id || await getFirstTrialSessionIdForStudent(current.student_id);
      return dedupeTags([
        { student_id: current.student_id },
        ...parentIds.map((parentId) => ({ parent_id: parentId })),
        ...(sessionId ? [{ session_id: sessionId }] : []),
      ]);
    }

    if (type === 'projects_without_lead') {
      return [];
    }

    if (type === 'reconciliation_contact_messages') {
      return [];
    }

    return [];
  };

  const appendTagsToIssueDescription = async (issue: IssueWithTags, tags: IssueTagDraft[]) => {
    const existingIssueTags = issue.tags
      .map(issueTagToDraft)
      .filter((tag): tag is IssueTagDraft => !!tag);
    const allTags = dedupeTags([...existingIssueTags, ...tags]);

    const currentDescription = issue.description as JSONContent | null;
    const currentDoc: JSONContent =
      currentDescription && currentDescription.type === 'doc'
        ? currentDescription
        : { type: 'doc', content: [] };

    const existingMentionKeys = new Set(
      extractMentions(currentDoc).map((mention) => `${mention.type}:${mention.id}`)
    );

    const mentionParagraphs: JSONContent[] = [];
    const labels = await resolveTagLabels(allTags);
    allTags.forEach((tag) => {
      const entity = getTagEntity(tag);
      if (!entity) return;

      const key = `${entity.type}:${entity.id}`;
      if (existingMentionKeys.has(key)) return;

      existingMentionKeys.add(key);
      mentionParagraphs.push({
        type: 'paragraph',
        content: [
          {
            type: 'mention',
            attrs: {
              id: entity.id,
              type: entity.type,
              label: labels.get(key) || entity.id,
            },
          },
          { type: 'text', text: ' ' },
        ],
      });
    });

    if (mentionParagraphs.length === 0) return;

    const updatedDescription: JSONContent = {
      ...currentDoc,
      content: [...(currentDoc.content || []), ...mentionParagraphs],
    };

    await issuesApi.update(issue.id, { description: updatedDescription as IssueUpdate['description'] });
    queryClient.invalidateQueries({ queryKey: ['issues'] });
  };

  const handleCreateIssue = async () => {
    try {
      setIsIssueActionLoading(true);
      const tags = await getIssueTagsForItem();
      setCreateIssueTags(tags);
      setIsCreateIssueOpen(true);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Failed to open issue',
        description: errorMessage || 'Unable to open issue flow',
        variant: 'destructive',
      });
    } finally {
      setIsIssueActionLoading(false);
    }
  };

  const handleAddToIssue = async (issue: IssueWithTags) => {
    try {
      setIsIssueActionLoading(true);
      const tags = await getIssueTagsForItem();
      await appendTagsToIssueDescription(issue, tags);
      setSelectedIssueId(issue.id);
      setIsEditIssueOpen(true);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Failed to open issue',
        description: errorMessage || 'Unable to open issue flow',
        variant: 'destructive',
      });
    } finally {
      setIsIssueActionLoading(false);
    }
  };

  const issueButton = (type === 'failed_delivery_messages' || type === 'reconciliation_contact_messages') ? null : (
    matchedIssues.length === 0 ? (
      <Button
        variant="outline"
        size="sm"
        onClick={handleCreateIssue}
        disabled={isIssueActionLoading}
      >
        <Plus className="h-4 w-4 mr-1" />
        Open issue
      </Button>
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isIssueActionLoading}
          >
            <Plus className="h-4 w-4 mr-1" />
            Open issue
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleCreateIssue}>
            Create new issue
          </DropdownMenuItem>
          {matchedIssues.map((issue) => (
            <DropdownMenuItem
              key={issue.id}
              onClick={() => handleAddToIssue(issue)}
            >
              <span className="mr-1">Add to open issue:</span>
              {issue.name ?? ''}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  );
  let content: React.ReactNode = null;

  if (type === 'uninvoiced_sessions') {
    const session = item as UninvoicedSession;
    content = (
      <div className="flex flex-nowrap gap-2 items-center">
        <Button
          variant="default"
          size="sm"
          onClick={() => handleSendInvoice(session.sessions_students_id)}
          disabled={isLoading || invoiceSessionMutation.isPending}
        >
          <CreditCard className="h-4 w-4 mr-1" />
          {invoiceSessionMutation.isPending ? 'Invoicing...' : 'Invoice Session'}
        </Button>
        {issueButton}
      </div>
    );
  } else if (type === 'void_invoice_sessions') {
    const session = item as VoidInvoiceSession;
    content = (
      <div className="flex flex-nowrap gap-2 items-center">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            if (
              !window.confirm(
                'Delete this void invoice and its line items in the database? This cannot be undone from here. Stripe is not changed.'
              )
            ) {
              return;
            }
            archiveVoidInvoiceMutation.mutate(session.void_invoice_id);
          }}
          disabled={archiveVoidInvoiceMutation.isPending}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {archiveVoidInvoiceMutation.isPending ? 'Deleting…' : 'Delete void invoice'}
        </Button>
        {issueButton}
      </div>
    );
  } else if (type === 'unpaid_invoices') {
    const invoice = item as UnpaidInvoice;
    content = (
      <div className="flex flex-nowrap gap-2 items-center">
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
        {issueButton}
      </div>
    );
  } else if (type === 'unlogged_sessions') {
    const session = item as UnloggedSession;
    const firstStaffId = session.assigned_tutors && session.assigned_tutors.length > 0
      ? session.assigned_tutors[0].id
      : undefined;

    content = (
      <div className="flex flex-nowrap gap-2 items-center">
        <Button
          variant="default"
          size="sm"
          onClick={() => handlers.onLogSession(session.session_id, firstStaffId)}
          disabled={isLoading}
        >
          <FileText className="h-4 w-4 mr-1" />
          Log Session
        </Button>
        {issueButton}
      </div>
    );
  } else if (type === 'unassigned_classes') {
    const classItem = item as UnassignedClass;
    content = (
      <div className="flex flex-nowrap gap-2 items-center">
        <Button
          variant="default"
          size="sm"
          onClick={() => handlers.onAssignStaff(classItem.class_id)}
        >
          <User className="h-4 w-4 mr-1" />
          Assign Staff
        </Button>
        {issueButton}
      </div>
    );
  } else if (type === 'failed_delivery_messages') {
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

    content = (
      <div className="flex flex-nowrap gap-2 items-center">
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
  } else if (type === 'students_without_payment_method') {
    const student = item as StudentWithoutPaymentMethod;
    const handleOpenStripeSync = () => {
      router.push(`/settings/stripe-sync?studentId=${student.student_id}`);
    };

    content = (
      <div className="flex flex-nowrap gap-2 items-center">
        <Button
          variant="default"
          size="sm"
          onClick={handleOpenStripeSync}
        >
          <CreditCard className="h-4 w-4 mr-1" />
          Stripe Sync
        </Button>
        {issueButton}
      </div>
    );
  } else if (type === 'students_without_classes') {
    const student = item as StudentWithoutClasses;
    content = (
      <div className="flex flex-nowrap gap-2 items-center">
        <Button
          variant="default"
          size="sm"
          onClick={() => handlers.onAddClass(student.student_id, student.subject_id)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Class
        </Button>
        {issueButton}
      </div>
    );
  } else if (type === 'trial_students_not_signed_up') {
    const student = item as TrialStudentNotSignedUp;
    content = (
      <div className="flex flex-nowrap gap-2 items-center">
        <Button
          variant="default"
          size="sm"
          onClick={() => handleMessageStudent(student.student_id)}
          disabled={isLoading}
        >
          <MessageCircle className="h-4 w-4 mr-1" />
          Message
        </Button>
        {issueButton}
      </div>
    );
  } else if (type === 'projects_without_lead') {
    const project = item as ProjectWithoutLead;
    content = (
      <div className="flex flex-nowrap gap-2 items-center">
        <Button variant="default" size="sm" onClick={() => handlers.onOpenProject(project.id)}>
          <FileText className="h-4 w-4 mr-1" />
          Edit project
        </Button>
        {issueButton}
      </div>
    );
  } else if (type === 'reconciliation_contact_messages') {
    const row = item as AggregatedConversation;
    const contactName = row.contact ? formatContactName({ contacts: row.contact }) : 'Unknown';
    const convId = row.conversations[0]?.id;

    content = (
      <div className="flex flex-nowrap gap-2 items-center">
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            if (convId) openWindow({ conversationId: convId, title: contactName });
          }}
          disabled={!convId}
        >
          <MessageCircle className="h-4 w-4 mr-1" />
          Message
        </Button>
      </div>
    );
  }

  return (
    <>
      {content}
      <CreateIssueDialog
        isOpen={isCreateIssueOpen}
        onClose={() => {
          setIsCreateIssueOpen(false);
          setCreateIssueTags([]);
        }}
        initialTags={createIssueTags}
      />
      <EditIssueDialog
        isOpen={isEditIssueOpen}
        issueId={selectedIssueId}
        onClose={() => {
          setIsEditIssueOpen(false);
          setSelectedIssueId(null);
        }}
      />
    </>
  );
}
