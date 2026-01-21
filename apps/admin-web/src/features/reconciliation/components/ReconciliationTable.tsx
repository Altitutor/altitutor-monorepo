'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ReconciliationActions } from './ReconciliationActions';
import { useSubjects } from '@/features/subjects';
import { formatSubjectDisplay, getSubjectColorStyle, formatSessionType, getSessionTypeBadgeColor, cn } from '@/shared/utils';
import { AttendanceCell } from '@/features/sessions/components/AttendanceCell';
import type { Tables } from '@altitutor/shared';
import type {
  UninvoicedSession,
  UnpaidInvoice,
  UnloggedSession,
  UnassignedClass,
  UnrepliedMessage,
  FailedDeliveryMessage,
  StudentWithoutClasses,
  StudentWithoutPaymentMethod,
  TrialStudentNotSignedUp,
} from '../types';

interface ReconciliationTableProps<T> {
  title: string;
  items: T[];
  isLoading?: boolean;
  renderRow: (item: T, index: number) => React.ReactNode;
  columns: string[];
}

export function ReconciliationTable<T>({
  title,
  items,
  isLoading = false,
  renderRow,
  columns,
}: ReconciliationTableProps<T>) {
  const [isExpanded, setIsExpanded] = useState(true);

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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
                <TableHead className="w-[200px]">Actions</TableHead>
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
                items.map((item, index) => renderRow(item, index))
              )}
            </TableBody>
          </Table>
        </div>
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
  return (
    <ReconciliationTable
      title="Uninvoiced Sessions"
      items={items}
      isLoading={isLoading}
      columns={['Date', 'Student', 'Session', 'Planned Attendance', 'Actual Attendance']}
      renderRow={(item, index) => {
        // Calculate planned attendance status
        let plannedStatus: 'attending' | 'attending-extra' | 'absent' | 'rescheduled' | 'credited' | 'unplanned' = 'attending';
        
        if (item.planned_absence) {
          if (item.is_rescheduled) {
            plannedStatus = 'rescheduled';
          } else if (item.is_credited) {
            plannedStatus = 'credited';
          } else {
            plannedStatus = 'absent';
          }
        } else if (item.is_extra) {
          plannedStatus = 'attending-extra';
        }
        
        // Calculate actual attendance status
        let actualStatus: 'attended' | 'did-not-attend' | 'not-logged' = 'not-logged';
        if (item.has_tutor_log) {
          if (item.actual_attended === true) {
            actualStatus = 'attended';
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
            <TableCell className="font-medium">
              {item.student_first_name} {item.student_last_name}
            </TableCell>
            <TableCell>
              {item.session_name || '—'}
            </TableCell>
            <TableCell>
              <AttendanceCell status={plannedStatus} />
            </TableCell>
            <TableCell>
              <AttendanceCell status={actualStatus} />
            </TableCell>
            <TableCell>
              <ReconciliationActions type="uninvoiced_sessions" item={item} />
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
  return (
    <ReconciliationTable
      title="Unpaid Invoices"
      items={items}
      isLoading={isLoading}
      columns={['Date', 'Student', 'Amount Due', 'Status']}
      renderRow={(item, _index) => (
        <TableRow key={item.id}>
          <TableCell>
            {format(new Date(item.invoice_date), 'MMM d, yyyy')}
          </TableCell>
          <TableCell className="font-medium">
            {item.student_first_name} {item.student_last_name}
          </TableCell>
          <TableCell>
            ${(item.amount_due_cents / 100).toFixed(2)} {item.currency}
          </TableCell>
          <TableCell>
            <Badge variant={item.status === 'open' ? 'destructive' : 'secondary'}>
              {item.status}
            </Badge>
          </TableCell>
          <TableCell>
            <ReconciliationActions type="unpaid_invoices" item={item} />
          </TableCell>
        </TableRow>
      )}
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
  const { data: subjects = [] } = useSubjects();
  const subjectMap = useMemo(() => {
    const map = new Map<string, Tables<'subjects'>>();
    subjects.forEach(s => map.set(s.id, s));
    return map;
  }, [subjects]);

  return (
    <ReconciliationTable
      title="Unlogged Sessions"
      items={items}
      isLoading={isLoading}
      columns={['Date', 'Subject', 'Tutors']}
      renderRow={(item, _index) => {
        const subject = item.subject_id ? subjectMap.get(item.subject_id) : null;
        const { style, textColorClass } = getSubjectColorStyle(subject);
        const defaultClass = !subject?.color ? 'bg-gray-100 text-gray-800' : '';
        
        return (
          <TableRow key={item.session_id}>
            <TableCell>
              {format(new Date(item.start_at), 'MMM d, yyyy')}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2 flex-wrap">
                {subject ? (
                  <Badge
                    className={cn("text-xs whitespace-nowrap", defaultClass || textColorClass)}
                    style={style.backgroundColor ? style : undefined}
                  >
                    {formatSubjectDisplay(subject)}
                  </Badge>
                ) : (
                  <span>{item.subject_name || '—'}</span>
                )}
                <Badge className={getSessionTypeBadgeColor(item.session_type)}>
                  {formatSessionType(item.session_type)}
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              {item.assigned_tutors && item.assigned_tutors.length > 0
                ? item.assigned_tutors.map((t) => `${t.first_name} ${t.last_name}`).join(', ')
                : '—'}
            </TableCell>
            <TableCell>
              <ReconciliationActions type="unlogged_sessions" item={item} />
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
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const { data: subjects = [] } = useSubjects();
  const subjectMap = useMemo(() => {
    const map = new Map<string, Tables<'subjects'>>();
    subjects.forEach(s => map.set(s.id, s));
    return map;
  }, [subjects]);

  return (
    <ReconciliationTable
      title="Classes without staff"
      items={items}
      isLoading={isLoading}
      columns={['Subject', 'Day', 'Time', 'Students']}
      renderRow={(item, _index) => {
        const subject = item.subject_id ? subjectMap.get(item.subject_id) : null;
        const { style, textColorClass } = getSubjectColorStyle(subject);
        const defaultClass = !subject?.color ? 'bg-gray-100 text-gray-800' : '';
        
        return (
          <TableRow key={item.class_id}>
            <TableCell>
              {subject ? (
                <Badge
                  className={cn("text-xs whitespace-nowrap", defaultClass || textColorClass)}
                  style={style.backgroundColor ? style : undefined}
                >
                  {formatSubjectDisplay(subject)}
                </Badge>
              ) : (
                item.subject_name || '—'
              )}
            </TableCell>
            <TableCell>{dayNames[item.day_of_week]}</TableCell>
            <TableCell>
              {item.start_time} - {item.end_time}
            </TableCell>
            <TableCell>{item.student_count}</TableCell>
            <TableCell>
              <ReconciliationActions type="unassigned_classes" item={item} />
            </TableCell>
          </TableRow>
        );
      }}
    />
  );
}

export function UnrepliedMessagesTable({
  items,
  isLoading,
}: {
  items: UnrepliedMessage[];
  isLoading?: boolean;
}) {
  return (
    <ReconciliationTable
      title="Unreplied Messages"
      items={items}
      isLoading={isLoading}
      columns={['Last Message', 'Contact', 'Preview']}
      renderRow={(item, _index) => {
        const hoursAgo = item.hours_since_last_message
          ? Math.floor(item.hours_since_last_message)
          : null;

        return (
          <TableRow key={item.conversation_id}>
            <TableCell>
              {hoursAgo !== null ? `${hoursAgo}h ago` : '—'}
            </TableCell>
            <TableCell className="font-medium">
              {item.contact_name || item.contact_phone}
            </TableCell>
            <TableCell className="max-w-md truncate">
              {item.last_message_preview || '—'}
            </TableCell>
            <TableCell>
              <ReconciliationActions type="unreplied_messages" item={item} />
            </TableCell>
          </TableRow>
        );
      }}
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

        return (
          <TableRow key={item.message_id}>
            <TableCell>
              {hoursAgo !== null ? `${hoursAgo}h ago` : '—'}
            </TableCell>
            <TableCell className="font-medium">
              {item.contact_name || item.contact_phone}
            </TableCell>
            <TableCell>
              <Badge variant="destructive">{item.status}</Badge>
            </TableCell>
            <TableCell className="max-w-md truncate">
              {item.error_message || item.error_code || '—'}
            </TableCell>
            <TableCell>
              <ReconciliationActions type="failed_delivery_messages" item={item} />
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
  return (
    <ReconciliationTable
      title="Students with no payment method"
      items={items}
      isLoading={isLoading}
      columns={['Student', 'Email', 'Status']}
      renderRow={(item, _index) => (
        <TableRow key={item.student_id}>
          <TableCell className="font-medium">
            {item.first_name} {item.last_name}
          </TableCell>
          <TableCell>
            {item.email || '—'}
          </TableCell>
          <TableCell>
            <Badge variant="secondary">{item.student_status}</Badge>
          </TableCell>
          <TableCell>
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
      columns={['Student', 'Subject']}
      renderRow={(item, _index) => {
        const subject = subjectMap.get(item.subject_id) || {
          id: item.subject_id,
          name: item.subject_name,
          curriculum: item.subject_curriculum,
          year_level: item.subject_year_level,
        } as Tables<'subjects'>;
        const { style, textColorClass } = getSubjectColorStyle(subject);
        const defaultClass = !subject?.color ? 'bg-gray-100 text-gray-800' : '';
        
        return (
          <TableRow key={`${item.student_id}-${item.subject_id}`}>
            <TableCell className="font-medium">
              {item.first_name} {item.last_name}
            </TableCell>
            <TableCell>
              <Badge
                className={cn("text-xs whitespace-nowrap", defaultClass || textColorClass)}
                style={style.backgroundColor ? style : undefined}
              >
                {formatSubjectDisplay(subject)}
              </Badge>
            </TableCell>
            <TableCell>
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
  return (
    <ReconciliationTable
      title="Trial Students Who Haven't Signed Up"
      items={items}
      isLoading={isLoading}
      columns={['Student', 'Email']}
      renderRow={(item, _index) => (
        <TableRow key={item.student_id}>
          <TableCell className="font-medium">
            {item.first_name} {item.last_name}
          </TableCell>
          <TableCell>
            {item.email || '—'}
          </TableCell>
          <TableCell>
            <ReconciliationActions type="trial_students_not_signed_up" item={item} />
          </TableCell>
        </TableRow>
      )}
    />
  );
}
