'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
  DataTableToolbar,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { ReconciliationActions } from './ReconciliationActions';
import { EditTaskDialog } from '@/features/tasks/components/EditTaskDialog';
import { reconciliationKeys } from '../api/queryKeys';
import { useSubjects } from '@/features/subjects';
import { getSubjectColorStyle, cn } from '@/shared/utils';
import { AttendanceCell } from '@/features/sessions/components/AttendanceCell';
import type { DataTableState, Tables } from '@altitutor/shared';
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
  ProjectWithoutLead,
} from '../types';
import { AssignTaskDropdown } from './AssignTaskDropdown';
import { getStatusLabel } from '@/features/tasks/utils/taskUtils';
import type { TaskStatus } from '@/features/tasks/types';
import type { ProjectStatus, ProjectPriority } from '@/features/projects/types';
import { getProjectStatusLabel, getProjectPriorityLabel } from '@/features/projects/utils/projectUtils';
import { useConversationsByContact } from '@/features/messages/api/queries';
import type { AggregatedConversation } from '@/features/messages/types';
import { formatContactName } from '@/features/messages/utils/formatContactName';
import { useChatStore } from '@/features/messages/state/chatStore';
import { useReconciliationHandlers } from './ReconciliationActions';

/** Handlers used to open student / staff / parent modals from a message contact row. */
type ContactProfileHandlers = {
  onOpenStudent: (id: string) => void;
  onOpenStaff: (id: string) => void;
  onOpenParent: (id: string) => void;
};

function contactRowOpensProfile(contact: AggregatedConversation['contact'] | null): boolean {
  if (!contact) return false;
  if (contact.contact_type === 'STUDENT' && contact.student_id) return true;
  if (contact.contact_type === 'STAFF' && contact.staff_id) return true;
  if (contact.contact_type === 'PARENT' && contact.parent_id) return true;
  return false;
}

function openContactProfile(
  contact: AggregatedConversation['contact'] | null,
  handlers: ContactProfileHandlers
) {
  if (!contact) return;
  if (contact.contact_type === 'STUDENT' && contact.student_id) {
    handlers.onOpenStudent(contact.student_id);
    return;
  }
  if (contact.contact_type === 'STAFF' && contact.staff_id) {
    handlers.onOpenStaff(contact.staff_id);
    return;
  }
  if (contact.contact_type === 'PARENT' && contact.parent_id) {
    handlers.onOpenParent(contact.parent_id);
  }
}

function emptyToolbarState(search: string): DataTableState {
  return {
    search,
    filters: {},
    sortBy: null,
    sortDirection: 'desc',
    groupBy: null,
    page: 1,
    pageSize: 20,
    visibleColumns: [],
  };
}

/** Action buttons stay on one row; the table scrolls horizontally when the row is wider than the viewport. */
const ACTIONS_CELL = 'whitespace-nowrap align-middle';

function ReconciliationTableLinkButton({
  children,
  onClick,
  className,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return <span className={cn('text-muted-foreground', className)}>{children}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'cursor-pointer border-0 bg-transparent p-0 text-left text-primary underline-offset-4 hover:underline',
        className,
      )}
    >
      {children}
    </button>
  );
}

interface ReconciliationTableProps<T> {
  title: string;
  items: T[];
  isLoading?: boolean;
  renderRow: (item: T, index: number) => React.ReactNode;
  columns: string[];
  /** Client-side search over rows (default: JSON.stringify of each item). */
  getSearchableText?: (item: T) => string;
  searchPlaceholder?: string;
}

export function ReconciliationTable<T>({
  title,
  items,
  isLoading = false,
  renderRow,
  columns,
  getSearchableText,
  searchPlaceholder = 'Search…',
}: ReconciliationTableProps<T>) {
  const [isExpanded, setIsExpanded] = useState(items.length > 0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [toolbarSearch, setToolbarSearch] = useState('');

  const toolbarState = useMemo(() => emptyToolbarState(toolbarSearch), [toolbarSearch]);

  const filteredItems = useMemo(() => {
    const q = toolbarSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const text = getSearchableText ? getSearchableText(item) : JSON.stringify(item as object);
      return text.toLowerCase().includes(q);
    });
  }, [items, toolbarSearch, getSearchableText]);

  useEffect(() => {
    setPage(1);
  }, [toolbarSearch]);

  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <h3 className="text-lg font-semibold">{title}</h3>
          <Badge 
            variant={items.length === 0 ? "secondary" : "destructive"}
            className={items.length === 0 ? "bg-accent text-accent-foreground" : undefined}
          >
            {items.length}
          </Badge>
        </div>
      </div>

      {isExpanded && (
        <>
          <DataTableToolbar
            state={toolbarState}
            onSearchChange={setToolbarSearch}
            onFiltersChange={() => {}}
            onSortChange={() => {}}
            onGroupByChange={() => {}}
            onVisibleColumnsChange={() => {}}
            onQuickFilterApply={() => {}}
            onReset={() => setToolbarSearch('')}
            searchPlaceholder={searchPlaceholder}
          />
          <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
                <TableHead className="whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center h-24">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center h-24 text-muted-foreground">
                    No items found
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems.map((item, index) => {
                  const absoluteIndex = (page - 1) * pageSize + index;
                  return renderRow(item, absoluteIndex);
                })
              )}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      {isExpanded && !isLoading && totalItems > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={totalItems}
          onPageChange={setPage}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}

// Specific table components for each type
export function UninvoicedSessionsTable({
  items,
  isLoading,
}: {
  items: UninvoicedSession[];
  isLoading?: boolean;
}) {
  const handlers = useReconciliationHandlers();
  return (
    <ReconciliationTable
      title="Uninvoiced Sessions"
      items={items}
      isLoading={isLoading}
      columns={['Date', 'Student', 'Session', 'Planned', 'Actual']}
      renderRow={(item, index) => {
        const wasTrialPlanned = item.was_trial ?? false;
        // Calculate planned attendance status
        let plannedStatus: 'attending' | 'attending-extra' | 'attending-trial' | 'attending-extra-trial' | 'absent' | 'rescheduled' | 'credited' | 'unplanned' = 'attending';
        
        if (item.planned_absence) {
          if (item.is_rescheduled) {
            plannedStatus = 'rescheduled';
          } else if (item.is_credited) {
            plannedStatus = 'credited';
          } else {
            plannedStatus = 'absent';
          }
        } else if (item.is_extra) {
          plannedStatus = wasTrialPlanned ? 'attending-extra-trial' : 'attending-extra';
        } else {
          plannedStatus = wasTrialPlanned ? 'attending-trial' : 'attending';
        }
        
        // Calculate actual attendance status
        const wasTrialActual = item.actual_was_trial ?? false;
        let actualStatus: 'attended' | 'attended-trial' | 'did-not-attend' | 'not-logged' = 'not-logged';
        if (item.has_tutor_log) {
          if (item.actual_attended === true) {
            actualStatus = wasTrialActual ? 'attended-trial' : 'attended';
          } else if (item.actual_attended === false) {
            actualStatus = 'did-not-attend';
          }
        }

        // Use a combination of fields to ensure unique keys, even if sessions_students_id has duplicates
        const uniqueKey = `${item.sessions_students_id}-${item.session_id}-${index}`;
        
        return (
          <TableRow key={uniqueKey}>
            <TableCell>
              {format(new Date(item.session_start_at), 'MMM d, yyyy')}
            </TableCell>
            <TableCell>
              <ReconciliationTableLinkButton
                className="font-medium"
                onClick={() => handlers.onOpenStudent(item.student_id)}
              >
                {item.student_first_name} {item.student_last_name}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell>
              <ReconciliationTableLinkButton
                onClick={() => handlers.onOpenSession(item.session_id)}
              >
                {item.session_short_name?.trim() || '—'}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell>
              <AttendanceCell
                status={plannedStatus}
                linkText={
                  plannedStatus === 'credited' && item.absence_credited_at
                    ? format(new Date(item.absence_credited_at), 'dd/MM/yyyy')
                    : undefined
                }
              />
            </TableCell>
            <TableCell>
              <AttendanceCell status={actualStatus} />
            </TableCell>
            <TableCell className={ACTIONS_CELL}>
              <ReconciliationActions type="uninvoiced_sessions" item={item} />
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}

export function VoidInvoiceSessionsTable({
  items,
  isLoading,
}: {
  items: VoidInvoiceSession[];
  isLoading?: boolean;
}) {
  const handlers = useReconciliationHandlers();
  return (
    <ReconciliationTable
      title="Sessions on void invoices only"
      items={items}
      isLoading={isLoading}
      columns={['Date', 'Student', 'Session', 'Invoice number', 'Planned', 'Actual']}
      renderRow={(item, index) => {
        const wasTrialPlanned = item.was_trial ?? false;
        let plannedStatus: 'attending' | 'attending-extra' | 'attending-trial' | 'attending-extra-trial' | 'absent' | 'rescheduled' | 'credited' | 'unplanned' = 'attending';

        if (item.planned_absence) {
          if (item.is_rescheduled) {
            plannedStatus = 'rescheduled';
          } else if (item.is_credited) {
            plannedStatus = 'credited';
          } else {
            plannedStatus = 'absent';
          }
        } else if (item.is_extra) {
          plannedStatus = wasTrialPlanned ? 'attending-extra-trial' : 'attending-extra';
        } else {
          plannedStatus = wasTrialPlanned ? 'attending-trial' : 'attending';
        }

        const wasTrialActual = item.actual_was_trial ?? false;
        let actualStatus: 'attended' | 'attended-trial' | 'did-not-attend' | 'not-logged' = 'not-logged';
        if (item.has_tutor_log) {
          if (item.actual_attended === true) {
            actualStatus = wasTrialActual ? 'attended-trial' : 'attended';
          } else if (item.actual_attended === false) {
            actualStatus = 'did-not-attend';
          }
        }

        const uniqueKey = `${item.sessions_students_id}-${item.void_invoice_id}-${index}`;
        const invoiceNumberLabel =
          item.void_stripe_invoice_number?.trim() ||
          (item.void_stripe_invoice_id
            ? item.void_stripe_invoice_id.slice(0, 12)
            : item.void_invoice_id.slice(0, 8));
        const sessionLabel = item.session_short_name?.trim() || '—';

        return (
          <TableRow key={uniqueKey}>
            <TableCell>
              {format(new Date(item.session_start_at), 'MMM d, yyyy')}
            </TableCell>
            <TableCell>
              <ReconciliationTableLinkButton
                className="font-medium"
                onClick={() => handlers.onOpenStudent(item.student_id)}
              >
                {item.student_first_name} {item.student_last_name}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell>
              <ReconciliationTableLinkButton
                onClick={() => handlers.onOpenSession(item.session_id)}
              >
                {sessionLabel}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell>
              <ReconciliationTableLinkButton onClick={() => handlers.onOpenInvoice(item.void_invoice_id)}>
                {invoiceNumberLabel}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell>
              <AttendanceCell
                status={plannedStatus}
                linkText={
                  plannedStatus === 'credited' && item.absence_credited_at
                    ? format(new Date(item.absence_credited_at), 'dd/MM/yyyy')
                    : undefined
                }
              />
            </TableCell>
            <TableCell>
              <AttendanceCell status={actualStatus} />
            </TableCell>
            <TableCell className={ACTIONS_CELL}>
              <ReconciliationActions type="void_invoice_sessions" item={item} />
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}

export function UnpaidInvoicesTable({
  items,
  isLoading,
}: {
  items: UnpaidInvoice[];
  isLoading?: boolean;
}) {
  const handlers = useReconciliationHandlers();
  return (
    <ReconciliationTable
      title="Unpaid Invoices"
      items={items}
      isLoading={isLoading}
      columns={['Date', 'Student', 'Session', 'Invoice number']}
      renderRow={(item, _index) => {
        const sessionLabel = item.session_short_name?.trim() || '—';
        const invoiceNumberLabel =
          item.stripe_invoice_number?.trim() ||
          (item.stripe_invoice_id ? item.stripe_invoice_id.slice(0, 12) : item.id.slice(0, 8));

        return (
          <TableRow key={item.id}>
            <TableCell>
              {format(new Date(item.invoice_date), 'MMM d, yyyy')}
            </TableCell>
            <TableCell>
              <ReconciliationTableLinkButton
                className="font-medium"
                onClick={() => handlers.onOpenStudent(item.student_id)}
              >
                {item.student_first_name} {item.student_last_name}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell>
              <ReconciliationTableLinkButton
                onClick={() => item.session_id && handlers.onOpenSession(item.session_id)}
                disabled={!item.session_id}
              >
                {sessionLabel}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell>
              <ReconciliationTableLinkButton onClick={() => handlers.onOpenInvoice(item.id)}>
                {invoiceNumberLabel}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell className={ACTIONS_CELL}>
              <ReconciliationActions type="unpaid_invoices" item={item} />
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}

export function UnloggedSessionsTable({
  items,
  isLoading,
}: {
  items: UnloggedSession[];
  isLoading?: boolean;
}) {
  const handlers = useReconciliationHandlers();
  return (
    <ReconciliationTable
      title="Unlogged Sessions"
      items={items}
      isLoading={isLoading}
      columns={['Date', 'Session', 'Staff']}
      renderRow={(item, _index) => {
        const tutors = item.assigned_tutors ?? [];

        return (
          <TableRow key={item.session_id}>
            <TableCell>
              {format(new Date(item.start_at), 'MMM d, yyyy')}
            </TableCell>
            <TableCell>
              <ReconciliationTableLinkButton onClick={() => handlers.onOpenSession(item.session_id)}>
                {item.session_name}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell>
              {tutors.length === 0 ? (
                '—'
              ) : (
                <div className="flex flex-col gap-1">
                  {tutors.map((staff) => {
                    const label =
                      `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim() ||
                      staff.email ||
                      staff.id;
                    return (
                      <ReconciliationTableLinkButton key={staff.id} onClick={() => handlers.onOpenStaff(staff.id)}>
                        {label}
                      </ReconciliationTableLinkButton>
                    );
                  })}
                </div>
              )}
            </TableCell>
            <TableCell className={ACTIONS_CELL}>
              <ReconciliationActions type="unlogged_sessions" item={item} />
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}

export function UnassignedTasksTable({
  items,
  isLoading,
}: {
  items: UnassignedTask[];
  isLoading?: boolean;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  return (
    <>
      <ReconciliationTable
        title="Unassigned tasks"
        items={items}
        isLoading={isLoading}
        columns={['Title', 'Status', 'Issue/Project', 'Due date']}
        renderRow={(item, _index) => (
          <TableRow key={item.id}>
            <TableCell className="max-w-xs truncate" title={item.title}>
              <ReconciliationTableLinkButton
                className="font-medium"
                onClick={() => setSelectedTaskId(item.id)}
              >
                {item.title}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {getStatusLabel((item.status ?? 'backlog') as TaskStatus)}
              </Badge>
            </TableCell>
            <TableCell>
              {item.issue?.name ?? item.project?.name ?? '—'}
            </TableCell>
            <TableCell>
              {item.due_date ? format(new Date(item.due_date), 'MMM d, yyyy') : '—'}
            </TableCell>
            <TableCell className={ACTIONS_CELL}>
              <div className="flex flex-nowrap items-center gap-2">
                <AssignTaskDropdown taskId={item.id} />
              </div>
            </TableCell>
          </TableRow>
        )}
      />
      {selectedTaskId && (
        <EditTaskDialog
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          taskId={selectedTaskId}
          onTaskUpdated={() => {
            queryClient.invalidateQueries({ queryKey: reconciliationKeys.unassignedTasks() });
          }}
        />
      )}
    </>
  );
}

export function ProjectsWithoutLeadTable({
  items,
  isLoading,
}: {
  items: ProjectWithoutLead[];
  isLoading?: boolean;
}) {
  const handlers = useReconciliationHandlers();

  return (
    <ReconciliationTable
      title="Projects with no lead"
      items={items}
      isLoading={isLoading}
      columns={['Project', 'Status', 'Priority', 'Target', 'Created by']}
      renderRow={(item, _index) => {
        const creator = item.creator;
        const creatorName = creator
          ? `${creator.first_name ?? ''} ${creator.last_name ?? ''}`.trim() || '—'
          : '—';
        const targetLabel = item.target_date
          ? format(new Date(item.target_date), 'MMM d, yyyy')
          : '—';

        return (
          <TableRow key={item.id}>
            <TableCell className="max-w-xs truncate" title={item.name}>
              <ReconciliationTableLinkButton
                className="font-medium"
                onClick={() => handlers.onOpenProject(item.id)}
              >
                {item.name}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {getProjectStatusLabel((item.status ?? 'backlog') as ProjectStatus)}
              </Badge>
            </TableCell>
            <TableCell>
              {item.priority !== null && item.priority !== undefined
                ? getProjectPriorityLabel(item.priority as ProjectPriority)
                : '—'}
            </TableCell>
            <TableCell>{targetLabel}</TableCell>
            <TableCell className="max-w-[10rem] truncate" title={creatorName}>
              {creatorName}
            </TableCell>
            <TableCell className={ACTIONS_CELL}>
              <ReconciliationActions type="projects_without_lead" item={item} />
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}

export function UnassignedClassesTable({
  items,
  isLoading,
}: {
  items: UnassignedClass[];
  isLoading?: boolean;
}) {
  const handlers = useReconciliationHandlers();

  return (
    <ReconciliationTable
      title="Classes without staff"
      items={items}
      isLoading={isLoading}
      columns={['Class', 'Students']}
      renderRow={(item, _index) => (
        <TableRow key={item.class_id}>
          <TableCell>
            <ReconciliationTableLinkButton
              className="font-medium"
              onClick={() => handlers.onOpenClass(item.class_id)}
            >
              {item.class_display_name}
            </ReconciliationTableLinkButton>
          </TableCell>
          <TableCell>{item.student_count}</TableCell>
          <TableCell className={ACTIONS_CELL}>
            <ReconciliationActions type="unassigned_classes" item={item} />
          </TableCell>
        </TableRow>
      )}
    />
  );
}

export function FailedDeliveryMessagesTable({
  items,
  isLoading,
}: {
  items: FailedDeliveryMessage[];
  isLoading?: boolean;
}) {
  const openWindow = useChatStore((s) => s.openWindow);

  return (
    <ReconciliationTable
      title="Messages which failed delivery"
      items={items}
      isLoading={isLoading}
      columns={['Failed At', 'Contact', 'Status', 'Error']}
      renderRow={(item, _index) => {
        const hoursAgo = item.hours_since_failure
          ? Math.floor(item.hours_since_failure)
          : null;
        const contactTitle = item.contact_name || item.contact_phone;

        return (
          <TableRow key={item.message_id}>
            <TableCell>
              {hoursAgo !== null ? `${hoursAgo}h ago` : '—'}
            </TableCell>
            <TableCell>
              <ReconciliationTableLinkButton
                className="font-medium"
                onClick={() =>
                  openWindow({ conversationId: item.conversation_id, title: contactTitle })
                }
              >
                {contactTitle}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell>
              <Badge variant="destructive">{item.status}</Badge>
            </TableCell>
            <TableCell className="max-w-md truncate">
              {item.error_message || item.error_code || '—'}
            </TableCell>
            <TableCell className={ACTIONS_CELL}>
              <ReconciliationActions type="failed_delivery_messages" item={item} />
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}

export function UnreadMessagesTable() {
  const { data: conversations, isPending } = useConversationsByContact();
  const handlers = useReconciliationHandlers();

  const unreadItems = (conversations ?? []).filter((c) => c.unreadCount > 0);

  return (
    <ReconciliationTable
      title="Unread messages"
      items={unreadItems}
      isLoading={isPending}
      columns={['Last message', 'Contact']}
      renderRow={(item, index) => {
        const lastAt = item.latestMessageAt ? new Date(item.latestMessageAt) : null;
        const lastTime = lastAt ? format(lastAt, 'MMM d, yyyy HH:mm') : '—';
        const contactName = item.contact ? formatContactName({ contacts: item.contact }) : 'Unknown';
        const canOpenProfile = contactRowOpensProfile(item.contact);

        return (
          <TableRow key={item.contactId ?? index}>
            <TableCell>{lastTime}</TableCell>
            <TableCell>
              <ReconciliationTableLinkButton
                className="font-medium"
                onClick={() => openContactProfile(item.contact, handlers)}
                disabled={!canOpenProfile}
              >
                {contactName}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell className={ACTIONS_CELL}>
              <ReconciliationActions type="reconciliation_contact_messages" item={item} />
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}

export function MessagesToFollowUpTable() {
  const { data: conversations, isPending } = useConversationsByContact();
  const handlers = useReconciliationHandlers();

  const toFollowUpItems = (conversations ?? []).filter((c) =>
    c.conversations.some((conv) => conv.needs_follow_up)
  );

  return (
    <ReconciliationTable
      title="Messages to follow up"
      items={toFollowUpItems}
      isLoading={isPending}
      columns={['Last message', 'Contact']}
      renderRow={(item, index) => {
        const lastAt = item.latestMessageAt ? new Date(item.latestMessageAt) : null;
        const lastTime = lastAt ? format(lastAt, 'MMM d, yyyy HH:mm') : '—';
        const contactName = item.contact ? formatContactName({ contacts: item.contact }) : 'Unknown';
        const canOpenProfile = contactRowOpensProfile(item.contact);

        return (
          <TableRow key={item.contactId ?? index}>
            <TableCell>{lastTime}</TableCell>
            <TableCell>
              <ReconciliationTableLinkButton
                className="font-medium"
                onClick={() => openContactProfile(item.contact, handlers)}
                disabled={!canOpenProfile}
              >
                {contactName}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell className={ACTIONS_CELL}>
              <ReconciliationActions type="reconciliation_contact_messages" item={item} />
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}

export function StudentsWithoutPaymentMethodTable({
  items,
  isLoading,
}: {
  items: StudentWithoutPaymentMethod[];
  isLoading?: boolean;
}) {
  const handlers = useReconciliationHandlers();
  return (
    <ReconciliationTable
      title="Students with no payment method"
      items={items}
      isLoading={isLoading}
      columns={['Student']}
      renderRow={(item, _index) => (
        <TableRow key={item.student_id}>
          <TableCell>
            <ReconciliationTableLinkButton
              className="font-medium"
              onClick={() => handlers.onOpenStudent(item.student_id)}
            >
              {item.first_name} {item.last_name}
            </ReconciliationTableLinkButton>
          </TableCell>
          <TableCell className={ACTIONS_CELL}>
            <ReconciliationActions type="students_without_payment_method" item={item} />
          </TableCell>
        </TableRow>
      )}
    />
  );
}

export function StudentsWithoutClassesTable({
  items,
  isLoading,
}: {
  items: StudentWithoutClasses[];
  isLoading?: boolean;
}) {
  const { data: subjects = [] } = useSubjects();
  const handlers = useReconciliationHandlers();
  const subjectMap = useMemo(() => {
    const map = new Map<string, Tables<'subjects'>>();
    subjects.forEach(s => map.set(s.id, s));
    return map;
  }, [subjects]);

  return (
    <ReconciliationTable
      title="Students Without Classes"
      items={items}
      isLoading={isLoading}
      columns={['Date', 'Student', 'Subject']}
      renderRow={(item, _index) => {
        const subject = subjectMap.get(item.subject_id) || {
          id: item.subject_id,
          name: item.subject_name,
          short_name: item.subject_short_name,
          long_name: item.subject_long_name,
          curriculum: item.subject_curriculum,
          year_level: item.subject_year_level,
        } as Tables<'subjects'>;
        const { style, textColorClass } = getSubjectColorStyle(subject);
        const defaultClass = !subject?.color ? 'bg-gray-100 text-gray-800' : '';
        
        return (
          <TableRow key={`${item.student_id}-${item.subject_id}`}>
            <TableCell>
              {item.subject_added_at 
                ? format(new Date(item.subject_added_at), 'MMM d, yyyy')
                : '—'}
            </TableCell>
            <TableCell>
              <ReconciliationTableLinkButton
                className="font-medium"
                onClick={() => handlers.onOpenStudent(item.student_id)}
              >
                {item.first_name} {item.last_name}
              </ReconciliationTableLinkButton>
            </TableCell>
            <TableCell>
              <Badge
                className={cn('text-xs whitespace-nowrap', defaultClass || textColorClass)}
                style={style.backgroundColor ? style : undefined}
              >
                {subject?.short_name?.trim() || subject?.name?.trim() || subject?.long_name?.trim() || ''}
              </Badge>
            </TableCell>
            <TableCell className={ACTIONS_CELL}>
              <ReconciliationActions type="students_without_classes" item={item} />
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}

export function TrialStudentsNotSignedUpTable({
  items,
  isLoading,
}: {
  items: TrialStudentNotSignedUp[];
  isLoading?: boolean;
}) {
  const handlers = useReconciliationHandlers();
  return (
    <ReconciliationTable
      title="Trial Students Who Haven't Signed Up"
      items={items}
      isLoading={isLoading}
      columns={['Date', 'Student']}
      renderRow={(item, _index) => (
        <TableRow key={item.student_id}>
          <TableCell>
            {item.first_trial_session_date && item.first_trial_session_id ? (
              <ReconciliationTableLinkButton
                onClick={() => handlers.onOpenSession(item.first_trial_session_id!)}
              >
                {format(new Date(item.first_trial_session_date), 'MMM d, yyyy')}
              </ReconciliationTableLinkButton>
            ) : item.first_trial_session_date ? (
              format(new Date(item.first_trial_session_date), 'MMM d, yyyy')
            ) : (
              '—'
            )}
          </TableCell>
          <TableCell>
            <ReconciliationTableLinkButton
              className="font-medium"
              onClick={() => handlers.onOpenStudent(item.student_id)}
            >
              {item.first_name} {item.last_name}
            </ReconciliationTableLinkButton>
          </TableCell>
          <TableCell className={ACTIONS_CELL}>
            <ReconciliationActions type="trial_students_not_signed_up" item={item} />
          </TableCell>
        </TableRow>
      )}
    />
  );
}
