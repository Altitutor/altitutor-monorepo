'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Loader2, Download } from 'lucide-react';
import { usePayments } from '../hooks';
import { formatDateTime } from '@/shared/utils';

type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

const getStatusVariant = (status: PaymentStatus): 'default' | 'secondary' | 'destructive' => {
  switch (status) {
    case 'succeeded':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'failed':
    case 'refunded':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const formatAmount = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};

export function PaymentHistoryTable() {
  const { data: payments, isLoading, error } = usePayments();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Error loading payment history: {error.message}
      </div>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No payment history yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Session</TableHead>
            <TableHead>Receipt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment: any) => (
            <TableRow key={payment.id}>
              <TableCell>
                {formatDateTime(payment.created_at)}
              </TableCell>
              <TableCell className="font-medium">
                {formatAmount(payment.amount)}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(payment.status)}>
                  {payment.status}
                </Badge>
              </TableCell>
              <TableCell>
                {payment.session?.subject?.name ? (
                  <div className="text-sm">
                    <p className="font-medium">{payment.session.subject.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(payment.session.start_at)}
                    </p>
                  </div>
                ) : (
                  '-'
                )}
              </TableCell>
              <TableCell>
                {payment.stripe_receipt_url ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a 
                      href={payment.stripe_receipt_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Receipt
                    </a>
                  </Button>
                ) : (
                  '-'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

