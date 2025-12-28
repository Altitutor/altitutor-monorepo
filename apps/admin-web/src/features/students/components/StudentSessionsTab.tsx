'use client';

import { useEffect, useState } from 'react';
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  Badge,
  useToast
} from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getSessionTitle, formatSessionDate, type SessionWithDetails } from '@/features/sessions/utils/session-helpers';

type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

interface SessionRow {
  sessionsStudentsId: string;
  session: SessionWithDetails;
  paymentAttempts: {
    id: string;
    attempt_number: number;
    amount_cents: number;
    status: PaymentStatus;
    stripe_payment_intent_id: string | null;
    charged_at: string | null;
  }[];
}

export function StudentSessionsTab({ student }: { student: Tables<'students'> }) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Get end of today in local timezone
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      
      // Query sessions_students to get all sessions for this student up to end of today
      const { data: sessionsStudents, error: ssError } = await supabase
        .from('sessions_students')
        .select(`
          id,
          session_id,
          sessions!inner(
            id,
            start_at,
            end_at,
            type,
            class_id,
            classes(
              id,
              day_of_week,
              start_time,
              end_time,
              level,
              subject_id,
              subjects(
                id,
                name,
                curriculum,
                year_level
              )
            )
          )
        `)
        .eq('student_id', student.id)
        .lte('sessions.start_at', endOfToday.toISOString())
        .order('sessions(start_at)', { ascending: false });

      if (ssError) {
        console.error('Error fetching sessions:', ssError);
        return;
      }

      // Get invoice items for these sessions
      const sessionsStudentsIds = sessionsStudents?.map((ss: any) => ss.id) || [];
      
      const invoiceItemsMap: Record<string, any[]> = {};
      if (sessionsStudentsIds.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from('invoice_items')
          .select('id, sessions_students_id, invoice_id, amount_cents, description, is_subsidy, invoice:invoices(status, stripe_invoice_id, stripe_charge_id, paid_at)')
          .in('sessions_students_id', sessionsStudentsIds)
          .order('created_at', { ascending: false });

        if (itemsError) {
          console.error('Error fetching invoice items:', itemsError);
        } else {
          for (const item of items || []) {
            if (!invoiceItemsMap[item.sessions_students_id]) {
              invoiceItemsMap[item.sessions_students_id] = [];
            }
            invoiceItemsMap[item.sessions_students_id].push(item);
          }
        }
      }

      // Transform the data
      const sessionRows: SessionRow[] = (sessionsStudents || []).map((ss: any) => {
        const sessionData = ss.sessions;
        // Map invoice items to paymentAttempts format for backward compatibility
        const invoiceItems = invoiceItemsMap[ss.id] || [];
        const paymentAttempts = invoiceItems.map((item: any) => ({
          id: item.id,
          sessions_students_id: item.sessions_students_id,
          amount_cents: item.amount_cents,
          status: item.invoice?.status === 'paid' ? 'succeeded' : item.invoice?.status || 'pending',
          stripe_payment_intent_id: null, // Invoices don't have payment intents directly
          stripe_charge_id: item.invoice?.stripe_charge_id || null,
          charged_at: item.invoice?.paid_at || null,
          attempt_number: 1, // Invoices don't have attempt numbers
        }));
        
        return {
          sessionsStudentsId: ss.id,
          session: {
            ...sessionData,
            class: sessionData.classes ? {
              ...sessionData.classes,
              subject: sessionData.classes.subjects || undefined
            } : undefined
          },
          paymentAttempts
        };
      });

      setSessions(sessionRows);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

  const formatAmount = (amountCents: number) => {
    return `$${(amountCents / 100).toFixed(2)}`;
  };

  const formatTime = (startAt: string | null, endAt: string | null) => {
    if (!startAt) return '-';
    
    const start = new Date(startAt);
    const startHours = start.getHours().toString().padStart(2, '0');
    const startMinutes = start.getMinutes().toString().padStart(2, '0');
    
    if (!endAt) return `${startHours}:${startMinutes}`;
    
    const end = new Date(endAt);
    const endHours = end.getHours().toString().padStart(2, '0');
    const endMinutes = end.getMinutes().toString().padStart(2, '0');
    
    return `${startHours}:${startMinutes} - ${endHours}:${endMinutes}`;
  };

  const getStatusBadge = (status: PaymentStatus) => {
    const variants: Record<PaymentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      processing: 'outline',
      succeeded: 'default',
      failed: 'destructive',
      refunded: 'secondary'
    };

    const labels: Record<PaymentStatus, string> = {
      pending: 'Pending',
      processing: 'Processing',
      succeeded: 'Succeeded',
      failed: 'Failed',
      refunded: 'Refunded'
    };

    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-muted-foreground">Loading sessions...</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-muted-foreground">No sessions found for this student.</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date & Time</TableHead>
            <TableHead>Class</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Payment Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((row) => (
            <TableRow key={row.session.id}>
              <TableCell>
                <div>
                  {row.session.start_at && (
                    <>
                      <div>{formatSessionDate(row.session.start_at)}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatTime(row.session.start_at, row.session.end_at)}
                      </div>
                    </>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="max-w-md">
                  {getSessionTitle(row.session)}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {row.paymentAttempts.length > 0 ? formatAmount(row.paymentAttempts[0].amount_cents) : '-'}
              </TableCell>
              <TableCell>
                {row.paymentAttempts.length > 0 ? (
                  <div>
                    {getStatusBadge(row.paymentAttempts[0].status)}
                    {row.paymentAttempts[0].attempt_number > 1 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (Attempt {row.paymentAttempts[0].attempt_number})
                      </span>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline">Not Billed</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

