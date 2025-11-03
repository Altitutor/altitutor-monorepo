'use client';

import { useEffect, useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  Badge,
  Button,
  useToast
} from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getSessionTitle, formatSessionDate, type SessionWithDetails } from '@/features/sessions/utils/session-helpers';

type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

interface SessionRow {
  sessionsStudentsId: string;
  session: SessionWithDetails;
  payment: {
    id: string;
    amount_cents: number;
    status: PaymentStatus;
    stripe_payment_intent_id: string | null;
    charged_at: string | null;
  } | null;
}

export function StudentSessionsTab({ student }: { student: Tables<'students'> }) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [chargingSessionId, setChargingSessionId] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      
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

      // Get payment information for these sessions
      const sessionsStudentsIds = sessionsStudents?.map((ss: any) => ss.id) || [];
      
      let paymentsMap: Record<string, any> = {};
      if (sessionsStudentsIds.length > 0) {
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('id, sessions_students_id, amount_cents, status, stripe_payment_intent_id, charged_at')
          .in('sessions_students_id', sessionsStudentsIds);

        if (paymentsError) {
          console.error('Error fetching payments:', paymentsError);
        } else {
          paymentsMap = (payments || []).reduce((acc: any, p: any) => {
            acc[p.sessions_students_id] = p;
            return acc;
          }, {});
        }
      }

      // Transform the data
      const sessionRows: SessionRow[] = (sessionsStudents || []).map((ss: any) => {
        const sessionData = ss.sessions;
        const payment = paymentsMap[ss.id] || null;
        
        return {
          sessionsStudentsId: ss.id,
          session: {
            ...sessionData,
            class: sessionData.classes ? {
              ...sessionData.classes,
              subject: sessionData.classes.subjects || undefined
            } : undefined
          },
          payment
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

  const handleTestCharge = async (sessionsStudentsId: string) => {
    setChargingSessionId(sessionsStudentsId);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/billing-test-charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sessionsStudentsId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to charge session');
      }

      toast({
        title: 'Success',
        description: `Payment initiated successfully. Status: ${data.status}`,
      });

      // Reload sessions to update payment status
      await loadSessions();
    } catch (error) {
      console.error('Failed to charge session:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to charge session',
        variant: 'destructive',
      });
    } finally {
      setChargingSessionId(null);
    }
  };

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
            <TableHead className="text-right">Actions</TableHead>
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
                {row.payment ? formatAmount(row.payment.amount_cents) : '-'}
              </TableCell>
              <TableCell>
                {row.payment ? getStatusBadge(row.payment.status) : (
                  <Badge variant="outline">Not Billed</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {!row.payment && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestCharge(row.sessionsStudentsId)}
                    disabled={chargingSessionId === row.sessionsStudentsId}
                  >
                    {chargingSessionId === row.sessionsStudentsId ? 'Charging...' : 'Test Charge'}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

