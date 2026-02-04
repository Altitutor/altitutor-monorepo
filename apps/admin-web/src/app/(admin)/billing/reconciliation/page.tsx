'use client';

import { useEffect, useState, useCallback } from 'react';
import { billingApi, type MissingPaymentObligation, type FailedPaymentAttempt, type StuckPaymentAttempt } from '@/features/billing';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Badge, useToast, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@altitutor/ui';
import { getErrorMessage } from '@/shared/utils';

export default function ReconciliationPage() {
  const { toast } = useToast();
  const [missingObligations, setMissingObligations] = useState<MissingPaymentObligation[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<FailedPaymentAttempt[]>([]);
  const [stuckAttempts, setStuckAttempts] = useState<StuckPaymentAttempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconciling] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Note: Reconciliation views are deprecated - Stripe handles reconciliation automatically for invoices
      // These API calls will fail gracefully since views no longer exist
      try {
        const [missing, failed, stuck] = await Promise.all([
          billingApi.getMissingPaymentObligations(),
          billingApi.getFailedPaymentAttempts(),
          billingApi.getStuckPaymentAttempts(),
        ]);
        setMissingObligations(missing);
        setFailedAttempts(failed);
        setStuckAttempts(stuck);
      } catch (viewError: unknown) {
        // Views don't exist anymore - Stripe handles reconciliation automatically
        setMissingObligations([]);
        setFailedAttempts([]);
        setStuckAttempts([]);
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error loading reconciliation data',
        description: errorMessage || 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleReconcile = async () => {
    // Stripe handles reconciliation automatically for invoices
    toast({
      title: 'Reconciliation handled automatically',
      description: 'Stripe automatically reconciles invoices. No manual reconciliation needed.',
    });
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  const formatAmount = (cents: number | null, currency: string = 'AUD') => {
    if (cents === null) return '-';
    return `$${(cents / 100).toFixed(2)} ${currency}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Reconciliation</h1>
          <p className="text-muted-foreground">
            Stripe automatically handles reconciliation for invoices. This page is kept for reference.
          </p>
        </div>
        <Button onClick={handleReconcile} disabled={reconciling || loading} variant="outline">
          {reconciling ? 'Reconciling...' : 'Info'}
        </Button>
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 dark:text-blue-400 font-semibold">Note:</div>
            <div className="text-blue-800 dark:text-blue-300">
              <p className="font-medium mb-1">Reconciliation is now automatic</p>
              <p className="text-sm">
                With the migration to Stripe Invoices, reconciliation is handled automatically by Stripe. 
                Failed payments are automatically retried using Smart Retries, and payment status is automatically 
                reconciled. Manual reconciliation is no longer needed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="text-muted-foreground">Loading reconciliation data...</div>
        </div>
      ) : (
        <>
          {/* Missing Payment Obligations */}
          <Card>
            <CardHeader>
              <CardTitle>Missing Payment Obligations ({missingObligations.length})</CardTitle>
              <CardDescription>
                Sessions that should have been charged but have no payment attempts (no billing account or payment method)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {missingObligations.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  No missing payment obligations
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session Date</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Expected Amount</TableHead>
                        <TableHead>Skip Reason</TableHead>
                        <TableHead>Contact</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {missingObligations.map((ob: any) => (
                        <TableRow key={ob.sessions_students_id}>
                          <TableCell>{formatDate(ob.session_start_at)}</TableCell>
                          <TableCell>{ob.subject_name || '-'}</TableCell>
                          <TableCell>
                            {ob.student_first_name} {ob.student_last_name}
                          </TableCell>
                          <TableCell>{formatAmount(ob.expected_amount_cents, ob.currency)}</TableCell>
                          <TableCell>
                            <Badge variant={ob.skip_reason === 'NO_BILLING_ACCOUNT' ? 'destructive' : 'secondary'}>
                              {ob.skip_reason === 'NO_BILLING_ACCOUNT' ? 'No Billing Account' : 'No Payment Method'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {ob.student_email || ob.student_phone || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Failed Payment Attempts */}
          <Card>
            <CardHeader>
              <CardTitle>Failed Payment Attempts ({failedAttempts.length})</CardTitle>
              <CardDescription>
                Payments that failed after 3 retry attempts (need manual follow-up)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {failedAttempts.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  No failed payment attempts requiring follow-up
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session Date</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Failure Code</TableHead>
                        <TableHead>Card</TableHead>
                        <TableHead>Contact</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failedAttempts.map((attempt: any) => (
                        <TableRow key={attempt.payment_attempt_id}>
                          <TableCell>{formatDate(attempt.session_start_at)}</TableCell>
                          <TableCell>{attempt.subject_name || '-'}</TableCell>
                          <TableCell>
                            {attempt.student_first_name} {attempt.student_last_name}
                          </TableCell>
                          <TableCell>{attempt.attempt_number}</TableCell>
                          <TableCell>{formatAmount(attempt.amount_cents, attempt.currency)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            <Badge variant="destructive">{attempt.failure_code || 'unknown'}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {attempt.card_brand && attempt.card_last4 
                              ? `${attempt.card_brand} ****${attempt.card_last4}` 
                              : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {attempt.student_email || attempt.student_phone || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stuck Payment Attempts */}
          <Card>
            <CardHeader>
              <CardTitle>Stuck Payment Attempts ({stuckAttempts.length})</CardTitle>
              <CardDescription>
                Payments stuck in pending/processing for over 24 hours (need reconciliation with Stripe)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stuckAttempts.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  No stuck payment attempts
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Created</TableHead>
                        <TableHead>Session Date</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Attempt</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment Intent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stuckAttempts.map((attempt: any) => (
                        <TableRow key={attempt.id}>
                          <TableCell>{formatDate(attempt.created_at)}</TableCell>
                          <TableCell>{formatDate(attempt.session_start_at)}</TableCell>
                          <TableCell>{attempt.subject_name || '-'}</TableCell>
                          <TableCell>
                            {attempt.student_first_name} {attempt.student_last_name}
                          </TableCell>
                          <TableCell>{attempt.attempt_number}</TableCell>
                          <TableCell>{formatAmount(attempt.amount_cents, attempt.currency)}</TableCell>
                          <TableCell>
                            <Badge variant={attempt.status === 'pending' ? 'secondary' : 'outline'}>
                              {attempt.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {attempt.stripe_payment_intent_id || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}







